(function () {

    document.addEventListener("DOMContentLoaded", function () {
        // Remove elements with "noscript" class - <noscript> is not
        // allowed in XHTML
        var noscripts = document.getElementsByClassName("noscript");
        for (var i = 0; i < noscripts.length; i++) {
            noscripts[i].parentNode.removeChild(noscripts[i]);
        }

        // Add script for expand content.
        var expandElements = document.getElementsByClassName("expand");
        for (var ixx = 0; ixx < expandElements.length; ixx++) {
            (function (el) {
                var expandContent = document.getElementById(el.getAttribute("data-content-id"));
                expandContent.style.display = "none";
                var arrow = document.createTextNode("◢ ");
                var arrowSpan = document.createElement("span");
                arrowSpan.appendChild(arrow);

                var link = document.createElement("a");
                link.setAttribute("href", "#!");
                while (el.firstChild != null) {
                    link.appendChild(el.removeChild(el.firstChild));
                }
                el.appendChild(arrowSpan);
                el.appendChild(link);

                var textSpan = document.createElement("span");
                textSpan.setAttribute("style", "font-weight: normal;");
                textSpan.appendChild(document.createTextNode(" (click to expand)"));
                el.appendChild(textSpan);


                var visible = true;

                var switchExpand = function () {
                    visible = !visible;
                    expandContent.style.display = visible ? "block" : "none";
                    arrowSpan.style.color = visible ? "#000" : "#888";
                    return false;
                };

                link.onclick = switchExpand;
                switchExpand();

            })(expandElements[ixx]);
        }


        var Console = {};

        Console.log = (function () {
            var consoleContainer =
                document.getElementById("console-container");
            var console = document.createElement("div");
            console.setAttribute("id", "console");
            consoleContainer.appendChild(console);

            return function (message) {
                var p = document.createElement('p');
                p.style.wordWrap = "break-word";
                p.appendChild(document.createTextNode(message));
                console.appendChild(p);
                while (console.childNodes.length > 25) {
                    console.removeChild(console.firstChild);
                }
                console.scrollTop = console.scrollHeight;
            }
        })();


        function Room(drawContainer) {

            /* A pausable event forwarder that can be used to pause and
             * resume handling of events (e.g. when we need to wait
             * for a Image's load event before we can process further
             * WebSocket messages).
             * The object's callFunction(func) should be called from an
             * event handler and give the function to handle the event as
             * argument.
             * Call pauseProcessing() to suspend event forwarding and
             * resumeProcessing() to resume it.
             */
            function PausableEventForwarder() {

                var pauseProcessing = false;
                // Queue for buffering functions to be called.
                var functionQueue = [];

                this.callFunction = function (func) {
                    // If message processing is paused, we push it
                    // into the queue - otherwise we process it directly.
                    if (pauseProcessing) {
                        functionQueue.push(func);
                    } else {
                        func();
                    }
                };

                this.pauseProcessing = function () {
                    pauseProcessing = true;
                };

                this.resumeProcessing = function () {
                    pauseProcessing = false;

                    // Process all queued functions until some handler calls
                    // pauseProcessing() again.
                    while (functionQueue.length > 0 && !pauseProcessing) {
                        var func = functionQueue.pop();
                        func();
                    }
                };
            }

            // The WebSocket object.
            var socket;
            // ID of the timer which sends ping messages.
            var pingTimerId;

            var isStarted = false;
            var playerCount = 0;

            // An array of PathIdContainer objects that the server
            // did not yet handle.
            // They are ordered by id (ascending).
            var pathsNotHandled = [];

            var nextMsgId = 1;

            var canvasDisplay = document.createElement("canvas");
            var canvasBackground = document.createElement("canvas");
            var canvasServerImage = document.createElement("canvas");
            var canvasArray = [canvasDisplay, canvasBackground,
                canvasServerImage];
            canvasDisplay.addEventListener("mousedown", function (e) {
                // Prevent default mouse event to prevent browsers from marking text
                // (and Chrome from displaying the "text" cursor).
                e.preventDefault();
            }, false);

            var labelPlayerCount = document.createTextNode("0");
            var optionContainer = document.createElement("div");


            var canvasDisplayCtx = canvasDisplay.getContext("2d");
            var canvasBackgroundCtx = canvasBackground.getContext("2d");
            var canvasServerImageCtx = canvasServerImage.getContext("2d");
            var canvasMouseMoveHandler;
            var canvasMouseDownHandler;

            var isActive = false;
            var mouseInWindow = false;
            var mouseDown = false;
            var currentMouseX = 0, currentMouseY = 0;
            var currentPreviewPath = null;

            var availableColors = [];
            var currentColorIndex;
            var colorContainers;
            var previewTransparency = 0.65;

            var availableThicknesses = [2, 3, 6, 10, 16, 28, 50];
            var currentThicknessIndex;
            var thicknessContainers;

            var availableDrawTypes = [
                {name: "Brush", id: 1, continuous: true},
                {name: "Line", id: 2, continuous: false},
                {name: "Rectangle", id: 3, continuous: false},
                {name: "Ellipse", id: 4, continuous: false}
            ];
            var currentDrawTypeIndex;
            var drawTypeContainers;


            var labelContainer = document.getElementById("labelContainer");
            var placeholder = document.createElement("div");
            placeholder.appendChild(document.createTextNode("Loading... "));
            var progressElem = document.createElement("progress");
            placeholder.appendChild(progressElem);

            labelContainer.appendChild(placeholder);

            function rgb(color) {
                return "rgba(" + color[0] + "," + color[1] + ","
                    + color[2] + "," + color[3] + ")";
            }

            function PathIdContainer(path, id) {
                this.path = path;
                this.id = id;
            }

            function Path(type, color, thickness, x1, y1, x2, y2) {
                this.type = type;
                this.color = color;
                this.thickness = thickness;
                this.x1 = x1;
                this.y1 = y1;
                this.x2 = x2;
                this.y2 = y2;

                function ellipse(ctx, x, y, w, h) {
                    /* Drawing a ellipse cannot be done directly in a
                     * CanvasRenderingContext2D - we need to use drawArc()
                     * in conjunction with scaling the context so that we
                     * get the needed proportion.
                     */
                    ctx.save();

                    // Translate and scale the context so that we can draw
                    // an arc at (0, 0) with a radius of 1.
                    ctx.translate(x + w / 2, y + h / 2);
                    ctx.scale(w / 2, h / 2);

                    ctx.beginPath();
                    ctx.arc(0, 0, 1, 0, Math.PI * 2, false);

                    ctx.restore();
                }

                this.draw = function (ctx) {
                    ctx.beginPath();
                    ctx.lineCap = "round";
                    ctx.lineWidth = thickness;
                    var style = rgb(color);
                    ctx.strokeStyle = style;

                    if (x1 == x2 && y1 == y2) {
                        // Always draw as arc to meet the behavior
                        // in Java2D.
                        ctx.fillStyle = style;
                        ctx.arc(x1, y1, thickness / 2.0, 0,
                            Math.PI * 2.0, false);
                        ctx.fill();
                    } else {
                        if (type == 1 || type == 2) {
                            // Draw a line.
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                        } else if (type == 3) {
                            // Draw a rectangle.
                            if (x1 == x2 || y1 == y2) {
                                // Draw as line
                                ctx.moveTo(x1, y1);
                                ctx.lineTo(x2, y2);
                                ctx.stroke();
                            } else {
                                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                            }
                        } else if (type == 4) {
                            // Draw a ellipse.
                            ellipse(ctx, x1, y1, x2 - x1, y2 - y1);
                            ctx.closePath();
                            ctx.stroke();
                        }
                    }
                };
            }


            function connect() {
                var host = (window.location.protocol == "https:"
                    ? "wss://" : "ws://") + window.location.host
                    + "/examples/websocket/drawboard";
                socket = new WebSocket(host);

                /* Use a pausable event forwarder.
                 * This is needed when we load an Image object with data
                 * from a previous message, because we must wait until the
                 * Image's load event it raised before we can use it (and
                 * in the meantime the socket.message event could be
                 * raised).
                 * Therefore we need this pausable event handler to handle
                 * e.g. socket.onmessage and socket.onclose.
                 */
                var eventForwarder = new PausableEventForwarder();

                socket.onopen = function () {
                    // Socket has opened. Now wait for the server to
                    // send us the initial packet.
                    Console.log("WebSocket connection opened.");

                    // Set up a timer for pong messages.
                    pingTimerId = window.setInterval(function () {
                        socket.send("0");
                    }, 30000);
                };

                socket.onclose = function () {
                    eventForwarder.callFunction(function () {
                        Console.log("WebSocket connection closed.");
                        disableControls();

                        // Disable pong timer.
                        window.clearInterval(pingTimerId);
                    });
                };

                // Handles an incoming Websocket message.
                var handleOnMessage = function (message) {

                    // Split joined message and process them
                    // individually.
                    var messages = message.data.split(";");
                    for (var msgArrIdx = 0; msgArrIdx < messages.length;
                         msgArrIdx++) {
                        var msg = messages[msgArrIdx];
                        var type = msg.substring(0, 1);

                        if (type == "0") {
                            // Error message.
                            var error = msg.substring(1);
                            // Log it to the console and show an alert.
                            Console.log("Error: " + error);
                            alert(error);

                        } else {
                            if (!isStarted) {
                                if (type == "2") {
                                    // Initial message. It contains the
                                    // number of players.
                                    // After this message we will receive
                                    // a binary message containing the current
                                    // room image as PNG.
                                    playerCount = parseInt(msg.substring(1));

                                    refreshPlayerCount();

                                    // The next message will be a binary
                                    // message containing the room images
                                    // as PNG. Therefore we temporarily swap
                                    // the message handler.
                                    var originalHandler = handleOnMessage;
                                    handleOnMessage = function (message) {
                                        // First, we restore the original handler.
                                        handleOnMessage = originalHandler;

                                        // Read the image.
                                        var blob = message.data;
                                        // Create new blob with correct MIME type.
                                        blob = new Blob([blob], {type: "image/png"});

                                        var url = URL.createObjectURL(blob);

                                        var img = new Image();

                                        // We must wait until the onload event is
                                        // raised until we can draw the image onto
                                        // the canvas.
                                        // Therefore we need to pause the event
                                        // forwarder until the image is loaded.
                                        eventForwarder.pauseProcessing();

                                        img.onload = function () {

                                            // Release the object URL.
                                            URL.revokeObjectURL(url);

                                            // Set the canvases to the correct size.
                                            for (var i = 0; i < canvasArray.length; i++) {
                                                canvasArray[i].width = img.width;
                                                canvasArray[i].height = img.height;
                                            }

                                            // Now draw the image on the last canvas.
                                            canvasServerImageCtx.clearRect(0, 0,
                                                canvasServerImage.width,
                                                canvasServerImage.height);
                                            canvasServerImageCtx.drawImage(img, 0, 0);

                                            // Draw it on the background canvas.
                                            canvasBackgroundCtx.drawImage(canvasServerImage,
                                                0, 0);

                                            isStarted = true;
                                            startControls();

                                            // Refresh the display canvas.
                                            refreshDisplayCanvas();


                                            // Finally, resume the event forwarder.
                                            eventForwarder.resumeProcessing();
                                        };

                                        img.src = url;
                                    };
                                }
                            } else {
                                if (type == "3") {
                                    // The number of players in this room changed.
                                    var playerAdded = msg.substring(1) == "+";
                                    playerCount += playerAdded ? 1 : -1;
                                    refreshPlayerCount();

                                    Console.log("Player " + (playerAdded
                                        ? "joined." : "left."));

                                } else if (type == "1") {
                                    // We received a new DrawMessage.
                                    var maxLastHandledId = -1;
                                    var drawMessages = msg.substring(1).split("|");
                                    for (var i = 0; i < drawMessages.length; i++) {
                                        var elements = drawMessages[i].split(",");
                                        var lastHandledId = parseInt(elements[0]);
                                        maxLastHandledId = Math.max(maxLastHandledId,
                                            lastHandledId);

                                        var path = new Path(
                                            parseInt(elements[1]),
                                            [parseInt(elements[2]),
                                                parseInt(elements[3]),
                                                parseInt(elements[4]),
                                                parseInt(elements[5]) / 255.0],
                                            parseFloat(elements[6]),
                                            parseFloat(elements[7]),
                                            parseFloat(elements[8]),
                                            parseFloat(elements[9]),
                                            parseFloat(elements[10]));

                                        // Draw the path onto the last canvas.
                                        path.draw(canvasServerImageCtx);
                                    }

                                    // Draw the last canvas onto the background one.
                                    canvasBackgroundCtx.drawImage(canvasServerImage,
                                        0, 0);

                                    // Now go through the pathsNotHandled array and
                                    // remove the paths that were already handled by
                                    // the server.
                                    while (pathsNotHandled.length > 0
                                    && pathsNotHandled[0].id <= maxLastHandledId)
                                        pathsNotHandled.shift();

                                    // Now me must draw the remaining paths onto
                                    // the background canvas.
                                    for (var i = 0; i < pathsNotHandled.length; i++) {
                                        pathsNotHandled[i].path.draw(canvasBackgroundCtx);
                                    }

                                    refreshDisplayCanvas();
                                }
                            }
                        }
                    }
                };

                socket.onmessage = function (message) {
                    eventForwarder.callFunction(function () {
                        handleOnMessage(message);
                    });
                };

            }


            function refreshPlayerCount() {
                labelPlayerCount.nodeValue = String(playerCount);
            }

            function refreshDisplayCanvas() {
                if (!isActive) { // Don't draw a curser when not active.
                    return;
                }

                canvasDisplayCtx.drawImage(canvasBackground, 0, 0);
                if (currentPreviewPath != null) {
                    // Draw the preview path.
                    currentPreviewPath.draw(canvasDisplayCtx);

                } else if (mouseInWindow && !mouseDown) {
                    canvasDisplayCtx.beginPath();
                    var color = availableColors[currentColorIndex].slice(0);
                    color[3] = previewTransparency;
                    canvasDisplayCtx.fillStyle = rgb(color);

                    canvasDisplayCtx.arc(currentMouseX, currentMouseY,
                        availableThicknesses[currentThicknessIndex] / 2,
                        0, Math.PI * 2.0, true);
                    canvasDisplayCtx.fill();
                }

            }

            function startControls() {
                isActive = true;

                labelContainer.removeChild(placeholder);
                placeholder = undefined;

                labelContainer.appendChild(
                    document.createTextNode("Number of Players: "));
                labelContainer.appendChild(labelPlayerCount);


                drawContainer.style.display = "block";
                drawContainer.appendChild(canvasDisplay);

                drawContainer.appendChild(optionContainer);

                canvasMouseDownHandler = function (e) {
                    if (e.button == 0) {
                        currentMouseX = e.pageX - canvasDisplay.offsetLeft;
                        currentMouseY = e.pageY - canvasDisplay.offsetTop;

                        mouseDown = true;
                        canvasMouseMoveHandler(e);

                    } else if (mouseDown) {
                        // Cancel drawing.
                        mouseDown = false;
                        currentPreviewPath = null;

                        currentMouseX = e.pageX - canvasDisplay.offsetLeft;
                        currentMouseY = e.pageY - canvasDisplay.offsetTop;

                        refreshDisplayCanvas();
                    }
                };
                canvasDisplay.addEventListener("mousedown", canvasMouseDownHandler, false);

                canvasMouseMoveHandler = function (e) {
                    var mouseX = e.pageX - canvasDisplay.offsetLeft;
                    var mouseY = e.pageY - canvasDisplay.offsetTop;

                    if (mouseDown) {
                        var drawType = availableDrawTypes[currentDrawTypeIndex];

                        if (drawType.continuous) {

                            var path = new Path(drawType.id,
                                availableColors[currentColorIndex],
                                availableThicknesses[currentThicknessIndex],
                                currentMouseX, currentMouseY, mouseX,
                                mouseY);
                            // Draw it on the background canvas.
                            path.draw(canvasBackgroundCtx);

                            // Send it to the sever.
                            pushPath(path);

                            // Refresh old coordinates
                            currentMouseX = mouseX;
                            currentMouseY = mouseY;

                        } else {
                            // Create a new preview path.
                            var color = availableColors[currentColorIndex].slice(0);
                            color[3] = previewTransparency;
                            currentPreviewPath = new Path(drawType.id,
                                color,
                                availableThicknesses[currentThicknessIndex],
                                currentMouseX, currentMouseY, mouseX,
                                mouseY, false);
                        }

                        refreshDisplayCanvas();
                    } else {
                        currentMouseX = mouseX;
                        currentMouseY = mouseY;

                        if (mouseInWindow) {
                            refreshDisplayCanvas();
                        }
                    }

                };
                document.addEventListener("mousemove", canvasMouseMoveHandler, false);

                document.addEventListener("mouseup", function (e) {
                    if (e.button == 0) {
                        if (mouseDown) {
                            mouseDown = false;
                            currentPreviewPath = null;

                            var mouseX = e.pageX - canvasDisplay.offsetLeft;
                            var mouseY = e.pageY - canvasDisplay.offsetTop;
                            var drawType = availableDrawTypes[currentDrawTypeIndex];

                            // If we are drawing a continuous path and the previous mouse coordinates are the same as
                            // the new ones, there is no need to construct a new draw message as we don't need to
                            // "terminate" a path as every path element contains both the start and the end point.
                            if (!(drawType.continuous && mouseX == currentMouseX && mouseY == currentMouseY)) {
                                var path = new Path(drawType.id, availableColors[currentColorIndex],
                                    availableThicknesses[currentThicknessIndex],
                                    currentMouseX, currentMouseY, mouseX,
                                    mouseY);
                                // Draw it on the background canvas.
                                path.draw(canvasBackgroundCtx);

                                // Send it to the sever.
                                pushPath(path);

                                // Refresh old coordinates
                                currentMouseX = mouseX;
                                currentMouseY = mouseY;
                            }

                            refreshDisplayCanvas();
                        }
                    }
                }, false);

                canvasDisplay.addEventListener("mouseout", function (e) {
                    mouseInWindow = false;
                    refreshDisplayCanvas();
                }, false);

                canvasDisplay.addEventListener("mousemove", function (e) {
                    if (!mouseInWindow) {
                        mouseInWindow = true;
                        refreshDisplayCanvas();
                    }
                }, false);


                // Create color and thickness controls.
                var colorContainersBox = document.createElement("div");
                colorContainersBox.setAttribute("style",
                    "margin: 4px; border: 1px solid #bbb; border-radius: 3px;");
                optionContainer.appendChild(colorContainersBox);

                colorContainers = new Array(3 * 3 * 3);
                for (var i = 0; i < colorContainers.length; i++) {
                    var colorContainer = colorContainers[i] =
                        document.createElement("div");
                    var color = availableColors[i] =
                        [
                            Math.floor((i % 3) * 255 / 2),
                            Math.floor((Math.floor(i / 3) % 3) * 255 / 2),
                            Math.floor((Math.floor(i / (3 * 3)) % 3) * 255 / 2),
                            1.0
                        ];
                    colorContainer.setAttribute("style",
                        "margin: 3px; width: 18px; height: 18px; "
                        + "float: left; background-color: " + rgb(color));
                    colorContainer.style.border = '2px solid #000';
                    colorContainer.addEventListener("mousedown", (function (ix) {
                        return function () {
                            setColor(ix);
                        };
                    })(i), false);

                    colorContainersBox.appendChild(colorContainer);
                }

                var divClearLeft = document.createElement("div");
                divClearLeft.setAttribute("style", "clear: left;");
                colorContainersBox.appendChild(divClearLeft);


                var drawTypeContainersBox = document.createElement("div");
                drawTypeContainersBox.setAttribute("style",
                    "float: right; margin-right: 3px; margin-top: 1px;");
                optionContainer.appendChild(drawTypeContainersBox);

                drawTypeContainers = new Array(availableDrawTypes.length);
                for (var i = 0; i < drawTypeContainers.length; i++) {
                    var drawTypeContainer = drawTypeContainers[i] =
                        document.createElement("div");
                    drawTypeContainer.setAttribute("style",
                        "text-align: center; margin: 3px; padding: 0 3px;"
                        + "height: 18px; float: left;");
                    drawTypeContainer.style.border = "2px solid #000";
                    drawTypeContainer.appendChild(document.createTextNode(
                        String(availableDrawTypes[i].name)));
                    drawTypeContainer.addEventListener("mousedown", (function (ix) {
                        return function () {
                            setDrawType(ix);
                        };
                    })(i), false);

                    drawTypeContainersBox.appendChild(drawTypeContainer);
                }


                var thicknessContainersBox = document.createElement("div");
                thicknessContainersBox.setAttribute("style",
                    "margin: 3px; border: 1px solid #bbb; border-radius: 3px;");
                optionContainer.appendChild(thicknessContainersBox);

                thicknessContainers = new Array(availableThicknesses.length);
                for (var i = 0; i < thicknessContainers.length; i++) {
                    var thicknessContainer = thicknessContainers[i] =
                        document.createElement("div");
                    thicknessContainer.setAttribute("style",
                        "text-align: center; margin: 3px; width: 18px; "
                        + "height: 18px; float: left;");
                    thicknessContainer.style.border = "2px solid #000";
                    thicknessContainer.appendChild(document.createTextNode(
                        String(availableThicknesses[i])));
                    thicknessContainer.addEventListener("mousedown", (function (ix) {
                        return function () {
                            setThickness(ix);
                        };
                    })(i), false);

                    thicknessContainersBox.appendChild(thicknessContainer);
                }


                divClearLeft = document.createElement("div");
                divClearLeft.setAttribute("style", "clear: left;");
                thicknessContainersBox.appendChild(divClearLeft);


                setColor(0);
                setThickness(0);
                setDrawType(0);

            }

            function disableControls() {
                document.removeEventListener("mousedown", canvasMouseDownHandler);
                document.removeEventListener("mousemove", canvasMouseMoveHandler);
                mouseInWindow = false;
                refreshDisplayCanvas();

                isActive = false;
            }

            function pushPath(path) {

                // Push it into the pathsNotHandled array.
                var container = new PathIdContainer(path, nextMsgId++);
                pathsNotHandled.push(container);

                // Send the path to the server.
                var message = container.id + "|" + path.type + ","
                    + path.color[0] + "," + path.color[1] + ","
                    + path.color[2] + ","
                    + Math.round(path.color[3] * 255.0) + ","
                    + path.thickness + "," + path.x1 + ","
                    + path.y1 + "," + path.x2 + "," + path.y2;

                socket.send("1" + message);
            }

            function setThickness(thicknessIndex) {
                if (typeof currentThicknessIndex !== "undefined")
                    thicknessContainers[currentThicknessIndex]
                        .style.borderColor = "#000";
                currentThicknessIndex = thicknessIndex;
                thicknessContainers[currentThicknessIndex]
                    .style.borderColor = "#d08";
            }

            function setColor(colorIndex) {
                if (typeof currentColorIndex !== "undefined")
                    colorContainers[currentColorIndex]
                        .style.borderColor = "#000";
                currentColorIndex = colorIndex;
                colorContainers[currentColorIndex]
                    .style.borderColor = "#d08";
            }

            function setDrawType(drawTypeIndex) {
                if (typeof currentDrawTypeIndex !== "undefined")
                    drawTypeContainers[currentDrawTypeIndex]
                        .style.borderColor = "#000";
                currentDrawTypeIndex = drawTypeIndex;
                drawTypeContainers[currentDrawTypeIndex]
                    .style.borderColor = "#d08";
            }


            connect();

            $("#clearCan").click(function () {
                var path = new Path(1,
                    availableColors[currentColorIndex],
                    availableThicknesses[currentThicknessIndex],
                    currentMouseX, currentMouseY, mouseX,
                    mouseY);
                // Draw it on the background canvas.
                path.draw(canvasBackgroundCtx);

                // Send it to the sever.
                pushPath(path);
                refreshDisplayCanvas();
            });
        }


        // Initialize the room
        var room = new Room(document.getElementById("drawContainer"));


    }, false);
})();