$(function () {
    $("#submit").click(function () {
        var formData = new FormData($('#uploadForm')[0]);
        $.ajax({
            type: 'post',
            url: "/examples/servlet/UploadHandleServlet",
            data: formData,
            cache: false,
            processData: false,
            contentType: false,
        }).success(function (message) {
            var time = new Date().toTimeString()
            $("#uploadMessage").prepend("<tr><td>" +time+ message + "</td></tr>")
            $("#fileUp").val("");
        }).error(function () {
            $("#uploadMessage").prepend("<tr><td>" +time+ "上传失败" + "</td></tr>")
        });
    });
});