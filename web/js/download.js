$(function () {
    $("#downLoad").click(function () {
        $.ajax({
            type: 'get',
            url: "/examples/servlet/ListFileServlet"
        }).success(function (message) {
            $("#downLoadMessage").innerHTML="";
            $("#downLoadMessage").prepend("<tr><td>" +message +"<a href="+message+">下载</a></td></tr>")
        }).error(function () {
            $("#uploadMessage").prepend("<tr><td>" +time+ "上传失败" + "</td></tr>")
        });
    });
});