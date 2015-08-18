# NetFlow

访问者流


服务器中打开netflow.html  查看demo。

配置项说明(configs)：

    var nodeWidth = 100; //节点宽度
    var linkHLWidth = 10; //linkHorizonalLineWidth
    var nodePadding = 1.5 * linkHLWidth; //节点上下间距
    var margin = {top: 10, right: 20, bottom: 20, left: 10}, //间距
        width = 960 - margin.left - margin.right, //宽
        height = 500 - margin.top - margin.bottom; //高

重要函数接口(API)：
----

1. createHead() 中涉及头部各层汇总信息内容和样式的修改。
2. createJqNodes() 涉及结点内容和样式的修改。
3. createFloatTag() 涉及浮框样式的修改。
4. allClickListener() 涉及显示全部数据时点击了节点或链接之后的响应。Ajax调用以及相关处理都在此处修改。
5. $("#chart").delegate("div.rect", "mouseover", function () {}) 鼠标移上节点的事件响应，涉及浮框内容的修改。
6. $("#chart").delegate("div.rect", "mouseout", function () {}) 鼠标移出节点的事件响应，默认响应为隐藏浮框。
7. $("#chart").on("click", function () {}) 显示部分数据时鼠标点解响应。

重要数据结构：
----

1.data

    var data = {
        nodeIndex: {}, // key is level + '_' + name
        linkIndex: {}, // key is sourceIndexInArray + '_' + targetIndexInArray
        nodes: undefined,
        links: undefined,
        rects: [] //jqnodes array
    };

2.node

    {
        color: "white",         //node color
        x: 0,                   //node left
        y: 0,                   //node top 
        dx: 100,                //node width
        dy: 455,                //node height
        indexInArray: 0,        //node's index in nodes array
        input: 0,               //node's input sum (links value sum as target node)
        output: 6,              //node's output sum (links value sum as source node)
        value: 6,               //node value (max of input and output)
        level: 0,               //node level
        name: "总点击量",       //node name
        sourceLinks: Array[2],  //node's links array as source node
        targetLinks: Array[0],  //node's links array as target node
        rect: p.fn.p.init[1]    //node's jqNode
    }

3.link

    {
        dy: 227.5,              //link path height
        sy: 0,                  //link path source end y
        ty: 0,                  //link path target end y
        source: Object,         //source node
        target: Object,         //target node
        value: 3                //link value
    }
