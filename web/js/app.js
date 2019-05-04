var stompClient = null;

function setConnected(connected) {
    $("#messages").html("");
}

function connect() {
    var socket = new SockJS('/examples/websocket/chat');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        setConnected(true);
        console.log('Connected: ' + frame);
        stompClient.subscribe('/topic/messages', function (message) {
            console.log('message: ' + message);
            var json = JSON.parse(message.body);
            var name = json.userName+": ";
            var text = json.message+"";
            showMessage(name+text);
        });
    });
}

function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    setConnected(false);
    console.log("Disconnected");
}

function sendMessage() {
    var userName = $("#userName").val();
    var message = $("#message").val();
    if(message==""){
        message = "Hello World!"
    }
    stompClient.send("/app/message", {}, JSON.stringify({'userName': userName,'message':message}));
}

function showMessage(message) {
    $("#messages").append("<tr><td>" + message + "</td></tr>");
}


$(function () {
    $("form").on('submit', function (e) {
        e.preventDefault();
    });
    connect();
    // $("#disconnect").click(function () {
    //     disconnect();
    // });
    $("#send").click(function () {
        sendMessage();
    });
//    userName 初始化
    $("#userName").val((parseInt((+new Date)*Math.random()).toString(32)));
});