var Chat = {};

Chat.socket = null;

Chat.connect = (function (host) {
    if ('WebSocket' in window) {
        Chat.socket = new WebSocket(host);
    } else if ('MozWebSocket' in window) {
        Chat.socket = new MozWebSocket(host);
    } else {
        Console.log('Error: WebSocket is not supported by this browser.');
        return;
    }

    Chat.socket.onopen = function () {
        Console.log('Info: WebSocket connection opened.');
        document.getElementById('chat').onkeydown = function (event) {
            if (event.keyCode == 13) {
                Chat.sendMessage();
            }
        };
    };

    Chat.socket.onclose = function () {
        document.getElementById('chat').onkeydown = null;
        Console.log('Info: WebSocket closed.');
    };

    Chat.socket.onmessage = function (message) {
        Console.log(message.data);
    };
});

Chat.initialize = function () {
    if (window.location.protocol == 'http:') {
        Chat.connect('ws://' + window.location.host + '/examples/websocket/chat');
    } else {
        Chat.connect('wss://' + window.location.host + '/examples/websocket/chat');
    }
};

Chat.sendMessage = (function () {
    var message = document.getElementById('chat').value;
    var userName = $("#userName").val();
    if(message==""){
        message = "Hello World!"
    }
    message= JSON.stringify({'userName': userName,'message':message});
    if (message != '') {
        Chat.socket.send(message);
        document.getElementById('chat').value = '';
    } else {
        Chat.socket.send("Hello World...");
    }

});

var Console = {};

Console.log = (function (message) {
    $("#messages").prepend("<tr><td>" + message + "</td></tr>");
    // var console = document.getElementById('console');
    // var p = document.createElement('p');
    // p.style.wordWrap = 'break-word';
    // p.innerHTML = message;
    // console.appendChild(p);
    // while (console.childNodes.length > 25) {
    //     console.removeChild(console.firstChild);
    // }
    // console.scrollTop = console.scrollHeight;
});

Chat.initialize();


document.addEventListener("DOMContentLoaded", function () {
    // Remove elements with "noscript" class - <noscript> is not allowed in XHTML
    var noscripts = document.getElementsByClassName("noscript");
    for (var i = 0; i < noscripts.length; i++) {
        noscripts[i].parentNode.removeChild(noscripts[i]);
    }
}, false);
$(function () {
    $("#userName").val((parseInt((+new Date) * Math.random()).toString(32)));
    $("#send").click(function () {
        Chat.sendMessage();
    });
});
