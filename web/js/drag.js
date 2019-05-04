(function(win, doc){

    var ua = navigator.userAgent,
        eventArr = ['touchstart', 'touchmove', 'touchend'];


    function Drag(opts) {
        this.opts = opts || {};
        this.opts.onStart = this.opts.onStart || function(e) {};
        this.opts.onMove = this.opts.onMove || function(e) {};
        this.opts.onMoveIn = this.opts.onMoveIn || function(e) {};
        this.opts.onEnd = this.opts.onEnd || function(e) {};

        this.init();
    }

    Drag.prototype = {
        $: function(e) {
            return doc.querySelectorAll(e);
            //选择器使用选择所有匹配元素
        }
    }

    Drag.prototype.init = function () {

        //需拖动的元素
        this.dragEle = typeof this.opts.dragEle === "string" ? this.$(this.opts.dragEle) : this.opts.dragEle;
        var len = this.dragEle.length
        if(!!len) {
            for (var i = len - 1; i >= 0; i--) {
                this.addEvent(this.dragEle[i])
            }
            // this.dragEle.forEach(function(v,i) {
            // 	alert('listener')
            // 	this.addEvent(v);
            // }, this);
        } else {
            this.addEvent(this.dragEle);
        }
    }

    Drag.prototype.addEvent = function(e) {
        for (var i = eventArr.length - 1; i >= 0; i--) {
            e.addEventListener(eventArr[i], this[eventArr[i]].bind(this), false);
        }
        // eventArr.forEach(function(v, i) {
        // 	e.addEventListener(v, this[v].bind(this), false);
        // }, this);
    }

    Drag.prototype.touchstart = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var tar = e.target;
        //执行定义在拖动开始时须执行的函数， 参数为即将拖动的元素
        this.opts.onStart(tar);
        //初始化拖动元素的位置信息；
        this.dragT = tar.offsetTop;
        this.dragL = tar.offsetLeft;
        this.dragW = tar.offsetWidth || tar.clientWidth;
        this.dragH = tar.offsetHeight || tar.clientHeight;
        //定义开始移动位置
        this.startX = e.pageX || e.touches[0].pageX;
        this.startY = e.pageY || e.touches[0].pageY;
        //重置移动参数
        this.moveX = this.moveY = 0;
    }

    Drag.prototype.touchmove = function(e) {
        var tar = e.target;
        this.opts.onMove(tar);
        this.nowX = e.pageX || e.touches[0].pageX;
        this.nowY = e.pageY || e.touches[0].pageY;

        //计算目标元素需移动的距离
        this.moveX = this.nowX - this.startX;
        this.moveY = this.nowY - this.startY;

        //检测是否越界，并调整
        this.checkOver(this.moveX, this.moveY);

        //进行拖动元素移动操作
        this.setMove(tar);

    }

    Drag.prototype.touchend = function(e) {
        var tar = e.target;
        this.opts.onEnd(tar);

    }

    Drag.prototype.setMove = function(e, type) {
        var x = this.moveX || 0,
            y = this.moveY || 0;
        if(type === 'reset') {
            e.style.cssText = '';
            return;
        }
        //如果已被移动

        e.style.cssText += 'position: absolute;-webkit-transform: translate('+x+'px,'+y+'px);-moz-transform: translate('+x+'px,'+y+'px);-o-transform: translate('+x+'px,'+y+'px);-ms-transform: translate('+x+'px,'+y+'px);';
    }

    Drag.prototype.checkOver = function(moveX, moveY) {
        //检测元素是否越界
        var aW = doc.body.clientWidth || window.screen.width,
            aH = doc.body.clientHeight || window.screen.height,
            x = this.dragL + moveX,
            y = this.dragT + moveY,
            w = this.dragL + this.dragW + moveX,
            h = this.dragT + this.dragH + moveY;
        if(x < 0) {
            this.moveX = - this.dragL;
        } else if(w > aW) {
            this.moveX = aW - this.dragL - this.dragW;
        }
        if(y < 0) {
            this.moveY = - this.dragT;
        } else if(h > aH) {
            this.moveY = aH - this.dragT - this.dragH;
        }
    }

    win.Drag = Drag;
})(window, document);