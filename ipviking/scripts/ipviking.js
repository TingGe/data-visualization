"use strict";

// 限制可被引用的域名
var approvedDomains = ['norse-corp.com'];
if (top.location != self.location && approvedDomains.indexOf(top.location.hostname) === -1) {
  top.location = self.location.href
}

// 每6个小时刷新页面
var refreshSeconds = 60 * 60 * 6; // 6 hours
setTimeout("location.reload()", refreshSeconds * 1000);

// 呈现消息
function showMessage(message) {
  document.getElementById('message-text').innerHTML = message;
  document.getElementById('message-panel').style.display = "block";
}

// 隐藏消息
function hideMessage() {
  document.getElementById('message-panel').style.display = 'none';
}


(function (window) {
  var VSN = "1.1";

  // 限制使用Chrome浏览器
  /*
   var isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
   if(!isChrome) {
   showMessage("The IPViking digital attack map only supports the Google Chrome browser.");
   return;
   }
   */

  var settings = {
    // 解析成数字的数据属性
    numberProps: ["dport", "latitude", "longitude", "latitude2", "longitude2"],
    // 作为统计信息更新的闪光的颜色
    triggerColor: "red",
    // 范围文本最低透明度
    minTextOpacity: 0.35,
    // 这个数字开始后丢弃攻击
    maxAttacks: 100,
    radius: 5,
    countryColor: d3.scale.log()
      .domain([1, 1200])
      .range([d3.rgb(30, 30, 30), d3.rgb(30, 65, 140)]),
    tableBarWidth: d3.scale.log()
      .domain([1, 500])
      .range([1, 130]),

    // 布局设置
    linkAnchor: false,
    linkSiblings: false,

    // 表格行数
    topTableRows: 10,
    portTableRows: 8,
    consoleTableRows: 8,
    pruneInterval: 3600,
    dataPruneInterval: 60,

    // Websocket 设置
    wsHost: "ws://64.19.78.244:443/",
    psk: "18c989796c61724d4661b019f2779848dd69ae62",
    wsTimeout: 30000
  };

  /*
   * HTML 接口
   */
  d3.selectAll(".vsn").text(VSN);

  var timestampedData = [];

  function prune() {
    // 使用 lodash 库, 用 _.select 实现折半搜索来找到时间对数范围的起始值

    var now = new Date().getTime() / 1000;

    for (var i in timestampedData) {
      if (timestampedData[i].pruneTS > now) break;
    }

    var expiredData = [];

    if (i > 0) {
      expiredData = timestampedData.splice(0, i);
    }

    for (var n = 0; n < expiredData.length; n++) {
      // todo:
      // statsManager.remove(timestampData[n]);
      linkModels.forEach(function (model) {
        model.remove(expiredData[n]);
      });
    }
  }

  var displayLabel = {
    // 显示常规信息的标签
    elt: d3.select("#display-label"),

    set: function (text) {
      this.elt.text(text);
    },

    clear: function () {
      this.elt.text("");
    }
  };

  if (!window.chrome) {
    displayLabel.set("Too slow? Try Chrome.");
  }

  d3.selectAll(".info-btn").on("click", function () {
    d3.event.preventDefault();
    var drawerContent = d3.select("#drawer");
    if (drawerContent.style("display") === "none") {
      drawerContent
        .transition()
        .style("display", "block");

      d3.selectAll(".info-btn").classed("blue-bg", true);
      d3.selectAll(".info-btn").classed("gray-bg", false);
      d3.selectAll(".info-text").classed('icon-info', false);
      d3.selectAll(".info-text").classed('icon-close', true);
    } else {
      drawerContent
        .transition()
        .style("display", "none");
      d3.selectAll(".info-btn").classed("gray-bg", true);
      d3.selectAll(".info-btn").classed("blue-bg", false);
      d3.selectAll(".info-text").classed('icon-info', true);
      d3.selectAll(".info-text").classed('icon-close', false);
    }
  });

  var loadingToggle = (function () {
    // 切换为加载HTML状态
    var loading = true;

    return function () {
      if (loading) {
        d3.select("#content")
          .transition()
          .duration(1000)
          .style("opacity", 1);

        d3.select("#loading")
          .transition()
          .duration(1000)
          .style("opacity", 0);
      } else {
        d3.select("#content").style("opacity", 0);
        d3.select("#loading")
          .transition()
          .duration(1000)
          .style("opacity", 1);
      }
    }
  })();
  loadingToggle();

  /*
   * 定义变量
   */

  // 监听 .toggles
  (function () {
    var toggles = d3.selectAll(".toggle");
    var data = toggles[0]
      .map(function (elt) {
        return d3.select(elt.getAttribute("data-target"));
      });

    toggles
      .data(data)
      .on("click", function (d) {
        d3.event.preventDefault();
        if (d.style("display") === "none") {
          d.style("display", "block");
        } else {
          d.style("display", "none");
        }
      });
  })();


  // 设置d3的地图
  var width = window.innerWidth,
    height = window.innerHeight;

  // 从经纬转换为像素坐标
  var projection = d3.geo.mercator()
    .scale(width / 8.5)
    .translate([width / 2, height / 1.7]);

  // 使用projection将geojson绘制为svg的path
  var path = d3.geo.path().projection(projection);

  // SVG -- 我们的空白画布
  var svg = d3.select("#content").append("svg")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", height);

  svg.append("defs")
    .append("filter")
    .attr("id", "blur")
    .append("feGaussianBlur")
    .attr("stdDeviation", 2);


  // 添加Attacks到 .attacks svg group
  var node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

  // 目标城市集群
  var _clusters = d3.map();

  var colorizer = d3.scale.category20();
  // 端口到属性的映射表
  var ports;


  /**************
   * 内部API
   */

  function spanWrap(content, classes) {
    // Returns the content wrapped in the span
    return '<span class="' + (classes ? classes.join(" ") : "") + '">' +
      content + '</span>'
  }

  function dist(x1, y1, x2, y2) {
    // Returns the distance between two points
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  function rgbaString(c, a) {
    // Helper to get the color as an rgba string
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
  }

  function parsePorts(rawPorts) {
    // Given the csv list of ports, process it
    var ports = [];
    for (var i = 0; i < rawPorts.length; ++i) {
      var port = parseInt(rawPorts[i].port);
      if (port in ports) {
        ports[port] = ports[port] + ", " + rawPorts[i].service;
      } else {
        ports[port] = rawPorts[i].service;
      }
    }

    // Fix certain port strings
    ports[80] = "http";
    return ports;
  }

  var getID = (function () {
    // Generate unique enough IDs
    var i = 0;
    return function () {
      return i++;
    }
  })();


  function flagPath(iso) {
    // Return the path to the flag for the given countrycode
    if (iso === "O1") {
      return "images/militarywhite.svg";
    } else {
      return "images/flags/" + iso + ".png";
    }
  }

  function flagTag(iso) {
    return '<span class="flag f16 ' + iso.toLowerCase() + '"></span>';
  }

  function isNumber(n) {
    // Returns true if n is a number
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  var particler = function () {
    // 返回 生成着色粒子的函数
    var particle = new Image(),
      tempFileCanvas = d3.select("#content")
        .append("canvas")
        .attr("class", "buffer")
        .node();

    particle.src = "data:image/png;base64,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";

    tempFileCanvas.width = 64;
    tempFileCanvas.height = 64;

    return function (r, g, b, a) {
      var imgCtx = tempFileCanvas.getContext("2d"),
        imgData, i;

      imgCtx.drawImage(particle, 0, 0);

      //if(particle.width > self.innerWidth){particle.width=self.innerWidth;} if(particle.width < 1){particle.width=1;}
      //if(particle.height > self.innerHeight){particle.height=self.innerHeight;} if(particle.height < 1){particle.height=1;}
      imgData = imgCtx.getImageData(2, 2, 64, 64);

      //imgData = imgCtx.getImageData(0, 0, particle.width, particle.height);

      i = imgData.data.length;
      while ((i -= 4) > -1) {
        imgData.data[i + 3] = imgData.data[i] * a;
        if (imgData.data[i + 3]) {
          imgData.data[i] = r;
          imgData.data[i + 1] = g;
          imgData.data[i + 2] = b;
        }
      }

      imgCtx.putImageData(imgData, 0, 0);
      return tempFileCanvas;
    }
  }();

  var nodeModel = {
    /*
     * 提供了一个API，用于管理各种力量的布局节点
     *
     * Node Types:
     * - Attack Nodes {type: attack}
     * - Target Nodes {type: target}
     * - Anchor Nodes, ie City {type: anchor}
     */

    // Configuration
    linkSiblings: true,
    linkAnchor: false,
    target: true,
    interval: 50,
    pathLength: 15,
    targetMaxAge: 200,
    scaleTargetVel: d3.scale.log().domain([1, 40]).range([40, 100]),

    // Constants
    ATTACKS: "attacks",
    TARGETS: "targets",
    ANCHORS: "anchors",

    lastPrune: new Date().getTime() / 1000,

    // The list of nodes, shared with the force layout
    nodes: undefined,
    // The list of links, shared with the force layout
    links: undefined,

    // Force layout to make the elements move correctly
    force: d3.layout.force()
      .size([width, height])
      .friction(0.25)
      .gravity(0)
      .charge(-10)
      .chargeDistance(50)
      .linkDistance(15)
      .linkStrength(function (d) {
        return d.linkStrength || 0.5;
      }),

    prune: function () {
      var now = new Date().getTime() / 1000;

      if (now - this.lastPrune > 10) {
        this.lastPrune = now;

        for (var i in this.nodes) {
          if (this.nodes[i].pruneTS > now) {
            if (i > 0) {
              this.nodes.splice(0, i);
            }
            break;
          }
        }

        for (var i in this.links) {
          if (this.links[i].pruneTS > now) {
            if (i > 0) {
              this.links.splice(0, i);
            }
            break;
          }
        }
      }
    },

    get: function (type) {
      return this.nodes.filter(function (n) {
        return n.type === type;
      });
    },

    _mapKey: function (d) {
      return d.city + d.latitude + d.longitude;
    },

    _remove: function (n, j) {
      for (var i = 0; i < this.links.length; i++) {
        if (this.links[i].source.id === n.id ||
          this.links[i].target.id === n.id) {
          this.links.splice(i--, 1);
        }
      }

      if (typeof j !== 'undefined') this.nodes.splice(j, 1);

      // Remove a node, and its associated links
      for (var i = 0; i < this.nodes.length; i++) {
        if (n.id === this.nodes[i].id) {
          this.nodes.splice(i--, 1);
        }
      }

    },

    _shift: function (type) {
      for (var i = 0; i < this.nodes.length; i++) {
        if (this.nodes[i].type === type) {
          this._remove(this.nodes[i], i);
          break;
        }
      }
    },

    _getsertAnchorFor: function (attack) {
      // Get the anchor for the given node, inserting it if its not present
      var key = this._mapKey(attack),
        anchor = this.nodes.filter(function (n) {
          return n.key === key;
        })[0];

      if (anchor) {
        return anchor;
      } else {
        var newAnchor = {
          id: getID(),
          key: key,
          type: this.ANCHORS,
          x: attack.cx,
          y: attack.cy,
          cx: attack.cx,
          cy: attack.cy,
          country: attack.country,
          city: attack.city,
          fixed: true,
          pruneTS: (new Date()).getTime() / 1000 + settings.dataPruneInterval
        }
        this.nodes.push(newAnchor);
        return newAnchor;
      }
    },

    pushAttack: function (attack) {
      /*
       * Push a new Attack
       * Nodes are inserted at the source location and linked to an anchor
       * centered at this source, and all of the adjacent nodes. Links
       * are stronger to nodes of the same type.
       */
      // Clear out old nodes
      while (this.get(this.ATTACKS).length > 50) {
        this._shift(this.ATTACKS);
      }
      if (this.linkSiblings) {
        var key = this._mapKey(attack),
          that = this;
        this.nodes.forEach(function (n) {
          if (that._mapKey(n) === key) {//&& n.dport === d.dport ) {
            that.links.push({
              source: n,
              target: attack,
              pruneTS: (new Date()).getTime() / 1000 + settings.dataPruneInterval,
              linkStrength: n.dport === attack.dport ? 0.5 : 0.25
            });
          }
        });
      }

      // Anchor
      var anchor = this._getsertAnchorFor(attack);
      if (this.linkAnchor) {
        this.links.push({source: anchor, target: attack, linkStrength: 1.0});
      }

      // Target
      if (this.target) {
        var initialVelocity = -0.0001;
        var target = {
          type: this.TARGETS,
          age: 0,
          path: [],
          h: dist(attack.x, attack.y, attack.targetX, attack.targetY),
          id: getID(),
          x: attack.x,
          y: attack.y,
          cx: attack.targetX,
          cy: attack.targetY,
          startX: attack.x,
          startY: attack.y,
          city: attack.city2,
          country: attack.country2,
          theta: Math.atan((attack.targetY - attack.y) /
            (attack.targetX - attack.x)),

          dport: attack.dport,
          pruneTS: (new Date()).getTime() / 1000 + settings.dataPruneInterval
        };
        // this.links.push({source: this._getsertAnchorFor(target),
        // target: target, linkStrength: 1.0});
        this.nodes.push(target);
      }

      // Decorate and add the attack node
      attack.type = this.ATTACKS;
      attack.age = 0;
      this.nodes.push(attack);

      // TODO - is this necessary?!
      this.force.start();
    },

    step: function () {
      // Step the simulation
      this.nodes.forEach(function (n) {
        n.age++;
      });

      this.get(this.TARGETS)
        .filter(function (t) {
          return t.age > this.targetMaxAge ||
            "arrivalAge" in t && t["arrivalAge"] + 40 < t.age;
        }, this)
        .forEach(function (t) {
          this._remove(t);
        }, this);
    },

    start: function () {
      // Start the layout
      var that = this;

      // Initialize the array references
      this.nodes = [];
      this.links = [];
      this.force
        .nodes(this.nodes)
        .links(this.links)
        .on("tick", (function () {
          //var targetTrack;

          return function (e) {
            // Tick the force layout
            that.step();
            that.get(that.ATTACKS).forEach(function (d) {
              var scale = 0.1;
              d.x += scale * (d.cx - d.x) * e.alpha;
              d.y += scale * (d.cy - d.y) * e.alpha;
            });

            that.get(that.TARGETS).forEach(function (d) {
              //DEBUGGING
              // if (!targetTrack) targetTrack = d.id;
              // Update the target's path
              d.path.unshift({x: d.x, y: d.y});
              if (d.path.length > that.pathLength)
                d.path.pop();

              if (d.arrivalAge) {
                d.fixed = true;
              } else {
                var travelled = dist(d.x, d.y, d.startX, d.startY),
                //v = (Math.sqrt(travelled * 50) + 180) * e.alpha,
                  v = that.scaleTargetVel(d.age) * e.alpha,
                  toTarget = dist(d.cx, d.cy, d.x, d.y);

                if (v <= toTarget) {
                  var theta = Math.atan2(d.cy - d.y, d.cx - d.x);
                  //r = v / d.h;
                  d.x += v * Math.cos(theta);
                  d.y += v * Math.sin(theta);
                } else {
                  //debugger;
                  // Arrived at target
                  d.x = d.cx;
                  d.y = d.cy;
                  d.arrivalAge = d.age;
                }
              }
            });
            that.force.resume();
          }
        })())
        .start();

      // Prevent the alpha from 'cooling' to 0
      d3.timer(this.force.resume);
    }
  };

  // 缓存和查询城市<=>城市链接的抽象模型
  var LinksModel = {
    // {ORIGINCOUNTRY: {ORIGINCITY: {TRGTCOUNTRY: {TRGTCOUNTRY: {DPORT: COUNT}}}}}
    // Created in via .extend: _links: {},
    // {COUNTRY: {CITY: {latitude: LAT, longitude: LON}}}
    _locs: {},

    insertLink: function (origin, target, port) {
      if (!(origin.country in this._links)) {
        this._links[origin.country] = {};
      }

      if (!(origin.city in this._links[origin.country])) {
        this._links[origin.country][origin.city] = {};
      }

      var originLinks = this._links[origin.country][origin.city];
      if (!(target.country in originLinks)) {
        originLinks[target.country] = {};
      }

      if (!(target.city in originLinks[target.country])) {
        originLinks[target.country][target.city] = {};
      }

      var targetLinks = originLinks[target.country][target.city]
      if (!(port in targetLinks)) {
        targetLinks[port] = 1;
      } else {
        targetLinks[port] = targetLinks[port] + 1;
      }
    },

    removeLink: function (origin, target, port) {
      var link1 = this._links[origin.country];

      if (!link1) return;

      var link2 = this._links[origin.country][origin.city];

      if (!link2) return;

      var target1 = link2[target.country];

      if (!target1) return;

      var target2 = link2[target.country][target.city];

      if (!target2) return;

      if (target2[port] > 1) {
        target2[port]--;
      } else if (target2[port] !== undefined) {
        delete target2[port];
      }
    },

    insertLoc: function (loc) {
      if (!(loc.country in this._locs)) {
        this._locs[loc.country] = {}
      }

      if (!(loc.city in this._locs)) {
        this._locs[loc.country][loc.city] =
        {latitude: loc.latitude, longitude: loc.longitude};
      }
    },

    removeLoc: function (loc, origin, target, port) {
      var link1 = this._links[origin.country];

      if (!link1) return;

      var link2 = this._links[origin.country][origin.city];

      if (!link2) return;

      var target1 = link2[target.country];

      if (!target1) return;

      var target2 = link2[target.country][target.city]

      if (!target2) return;

      if (!target2[port]) {
        delete this._links[origin.country][origin.city];
        delete this._locs[loc.country][loc.city]
      }
    },

    _distanceBetween: function (pt1, pt2) {
      return Math.sqrt(Math.pow(pt1[0] - pt2[0], 2) +
        Math.pow(pt1[1] - pt2[1], 2));
    },

    getCity: function (country, city) {
      if (country in this._locs && city in this._locs[country]) {
        var loc = this._locs[country][city],
          pt = projection([loc.longitude, loc.latitude]),
          info = {
            country: country,
            city: city,
            latitude: loc.latitude,
            longitude: loc.longitude,
            pt: pt
          };

        if (country in this._links && city in this._links[country]) {
          info.counts = this._links[country][city];
        }

        return info;
      }
    },

    getCities: function () {
      // Returns list of all cities
      var cities = [];
      for (var country in this._locs) {
        for (var city in this._locs[country]) {
          cities.push(this.getCity(country, city));
        }
      }
      return cities;
    },

    getCountry: function (country) {
      var cities = [];
      for (var city in this._links[country] || {}) {
        cities.push(this.getCity(country, city));
      }
      return cities;
    },

    pixelsFromNearest: function (pt) {
      // Returns the pixels from the nearest source
      var closest;
      for (var country in this._links) {
        for (var city in this._links[country]) {
          var info = this.getCity(country, city);

          if (info) {
            var distance = this._distanceBetween(pt, info.pt);
            if (!closest || distance < closest.distance) {
              info.distance = distance;
              closest = info;
            }
          }
        }
      }
      return closest
    },

    total: function (counts) {
      // Total up a counts array, recursive
      if (isNumber(counts)) {
        return counts;
      } else {
        var sum = 0;
        for (var key in counts) {
          sum += this.total(counts[key]);
        }
        return sum;
      }
    },

    cityToLinks: function (city, strokeOrigin, strokeTarget) {
      if (!city) return [];

      var links = [];
      for (var country in city.counts) {
        if (!city.counts[country]) continue;
        for (var cityKey in city.counts[country]) {
          var info = this.getCity(country, cityKey),
            counts = city.counts[country][cityKey];

          if (!info || !counts || !Object.keys(counts).length) continue;

          for (var dport in counts) {
            var r = circleScale(counts[dport]),
              color = colorizer(dport),
              source = {x: city.pt[0], y: city.pt[1], r: r},
              target = {x: info.pt[0], y: info.pt[1], r: r};

            if (strokeTarget) {
              source.strokeStyle = color;
            } else {
              source.fillStyle = color;
            }

            if (strokeOrigin) {
              target.strokeStyle = color;
            } else {
              target.fillStyle = color;
            }

            links.push({
              count: counts[dport],
              source: source,
              target: target,
              width: lineScale(counts[dport]),
              color: color
            });
          }
        }
      }
      return links.sort(function (l1, l2) {
        return l2.count - l1.count;
      });
    },

    dPortLinks: function (dport) {
      var links = []
      for (var sourceCountry in this._links) {
        for (var sourceCity in this._links[sourceCountry]) {
          var s = this.getCity(sourceCountry, sourceCity);
          for (var targetCountry in s.counts) {
            for (var targetCity in s.counts[targetCountry]) {
              var t = this.getCity(targetCountry, targetCity);
              for (var targetdport in s.counts[targetCountry][targetCity]) {
                var c = s.counts[targetCountry][targetCity][targetdport];
                if (dport && dport === targetdport) {
                  links.push({
                    count: c,
                    source: s,
                    target: t,
                    dport: dport
                  });
                }
              }
            }
          }
        }
      }
      return links;
    },

    extend: function (o) {
      o.__proto__ = this;
      o._links = {};
      return o;
    }
  };

  // Set up the link models, one for origins, and one for targets
  var linkModels = {
    origins: LinksModel.extend({
      insert: function (d) {
        this.insertLink(
          {country: d.country, city: d.city},
          {country: d.country2, city: d.city2},
          d.dport);

        this.insertLoc(
          {
            country: d.country,
            city: d.city,
            latitude: d.latitude,
            longitude: d.longitude
          });
      },
      remove: function (d) {
        this.removeLink(
          {country: d.country, city: d.city},
          {country: d.country2, city: d.city2},
          d.dport);

        this.removeLoc(
          {
            country: d.country,
            city: d.city,
            latitude: d.latitude,
            longitude: d.longitude
          }, {country: d.country, city: d.city},
          {country: d.country2, city: d.city2},
          d.dport);
      }
    }),

    targets: LinksModel.extend({
      insert: function (d) {
        this.insertLink(
          {country: d.country2, city: d.city2},
          {country: d.country, city: d.city},
          d.dport);

        this.insertLoc(
          {
            country: d.country2,
            city: d.city2,
            latitude: d.latitude2,
            longitude: d.longitude2
          });
      },
      remove: function (d) {
        this.removeLink(
          {country: d.country2, city: d.city2},
          {country: d.country, city: d.city},
          d.dport);

        this.removeLoc(
          {
            country: d.country2,
            city: d.city2,
            latitude: d.latitude2,
            longitude: d.longitude2
          }, {country: d.country2, city: d.city2},
          {country: d.country, city: d.city},
          d.dport);
      }
    })
  };

  var countryModel = {
    // The raw list of data
    _raw: undefined,
    _iso2: undefined,
    _iso3: undefined,
    _countries: undefined,

    push: function (country) {
      // Push a new country
      this._raw.push(country);
      if (country.iso2) this._iso2[country.iso2] = country;
      if (country.iso3) this._iso3[country.iso3] = country;
      if (country.country) this._countries[country.country] = country;
    },

    set: function (raw) {
      this._raw = [];
      this._iso2 = {};
      this._iso3 = {};
      this._countries = {};
      for (var i = 0; i < raw.length; i++) {
        this.push(raw[i]);
      }
    },

    getByIso2: function (iso2) {
      return this._iso2[iso2.toUpperCase()];
    },

    getByIso3: function (iso3) {
      return this._iso3[iso3.toUpperCase()];
    },

    getByCountry: function (country) {
      return this._countries[country];
    }
  };

  /*
   * painter handles rendering to the canvas
   */

  // Prepare canvas and buffer
  var canvas = d3.select("#content").append("canvas")
    .text("This browser doesn't support Canvas elements")
    .attr("id", "visible-canvas")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", height)

  var bufCanvas = d3.select("#content").append("canvas")
    .attr("class", "buffer overlay")
    .attr("width", width)
    .attr("height", height);

  // 使得绘制的元素比例一致
  var logScale = d3.scale.log()
    .domain([1, 200])
    .range([1, 10]);

  var lineScale = function (x) {
    return logScale(x)
  };
  var circleScale = function (x) {
    return Math.ceil(1.4 * logScale(x))
  };
  var colorScale = (function () {
    var log = d3.scale.log()
      .domain([1, 600])
      .range([1, 100]);
    return function (v) {
      return log(v);
    }
  })();

  var painter = {
    // The various drawings
    drawings: {
      // Draw the attack nodes
      nodes: {
        // The visible nodes
        active: true,
        nodeModel: nodeModel,
        // Canvas composition: "lighter", "darker", ...
        compositeOperation: undefined,

        getRadius: function (d) {
          // Given a node, return the radius
          var growthEnd = 60, growthMax = 80,
            growthStep = growthMax / growthEnd,
            shrinkEnd = 120, shrinkMin = 20,
            shrinkStep = (growthMax - shrinkMin) / (shrinkEnd - growthEnd);

          if (d.age >= 0 && d.age < growthEnd) {
            return growthStep * d.age;
          } else if (d.age < shrinkEnd) {
            return growthMax - shrinkStep * (d.age - growthEnd);
          } else {
            return shrinkMin;
          }
        },

        draw: function (context) {
          nodeModel.prune();

          if (this.compositeOperation) {
            context.globalCompositeOperation = this.compositeOperation;
          }

          var that = this;
          nodeModel.get(nodeModel.ATTACKS)
            .forEach(function (n) {
              var c = d3.rgb(colorizer(n.dport)),
                r = that.getRadius(n);
              context.drawImage(particler(c.r, c.g, c.b, 1),
                n.x - r / 2, n.y - r / 2, r, r);
            });

        }
      },

      // Draw new node pings
      pings: {
        active: true,
        order: -1,
        duration: 80,
        scaleRadius: d3.scale.linear().domain([1, 80]).range([1, 48]),
        scaleOpacity: d3.scale.linear().domain([1, 80]).range([1, 0]),
        draw: function (context) {
          var pi = Math.PI;
          for (var i = 0; i < nodeModel.nodes.length; i++) {
            var n = nodeModel.nodes[i];
            if (n.type === nodeModel.ATTACKS && n.age < this.duration) {
              context.globalAlpha = this.scaleOpacity(n.age);
              context.strokeStyle = colorizer(n.dport);
              context.lineWidth = 3;
              context.beginPath();
              context.arc(n.x, n.y, this.scaleRadius(n.age),
                0, 2 * pi);
              context.stroke();
            }
          }
        }
      },

      // Draw the origin nodes
      origins: {
        active: true,
        order: -2,
        draw: function (context) {
          context.globalAlpha = 0.65;
          context.fillStyle = "#fff";

          var cities = linkModels.origins.getCities();

          var ceil = Math.ceil;
          var pi = Math.PI;

          for (var i = 0; i < cities.length; i++) {
            var total = linkModels.origins.total(cities[i].counts),
              latlng = projection([cities[i].longitude,
                cities[i].latitude]),
              r = ceil(circleScale(total));
            context.beginPath();
            context.arc(latlng[0], latlng[1], r, 0, pi * 2);
            context.fill();
          }
        }
      },

      // Draw the city nodes
      targets: {
        active: true,
        order: -2,
        draw: function (context) {
          context.globalAlpha = 0.65;
          context.strokeStyle = "#fff";
          context.fillStyle = "#fff";

          var cities = linkModels.targets.getCities();

          var ceil = Math.ceil;
          var pi = Math.PI;

          for (var i = 0; i < cities.length; i++) {
            var total = linkModels.targets.total(cities[i].counts),
              latlng = projection([cities[i].longitude,
                cities[i].latitude]),
              r = ceil(circleScale(total));
            context.beginPath();
            context.arc(latlng[0], latlng[1], r, 0, pi * 2);
            context.stroke();
            context.fillRect(latlng[0] - 1, latlng[1] - 1, 2, 2);
          }
        }
      },

      // Draw the target impact
      targetImpact: {
        active: true,
        impactRadiusScale: d3.scale.linear().domain([1, 40]).range([1, 30]),
        impactOpacityScale: d3.scale.linear().domain([1, 40]).range([1, 0]),
        impactWidth: 1,

        draw: function (ctx) {
          var pi = Math.PI;

          ctx.fillStyle = "#f00";
          nodeModel.get(nodeModel.TARGETS)
            .forEach(function (n) {
              var c = d3.rgb(colorizer(n.dport)),
                afterArrival = n.age - n["arrivalAge"];
              r = 10;

              if ("arrivalAge" in n) {
                var r = this.impactRadiusScale(afterArrival);
                ctx.save();
                ctx.globalAlpha = this.impactOpacityScale(afterArrival);
                ctx.strokeStyle = c.toString();
                ctx.lineWidth = this.impactWidth;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, 2 * pi);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
              }

              if (n.path.length > 0) {
                var point = n.path[n.path.length - 1];
                if (n.x != point.x && n.y != point.y) {
                  ctx.save();
                  var grd = ctx.createLinearGradient(
                    n.x, n.y, point.x, point.y);
                  grd.addColorStop(0, rgbaString(c, 1));
                  grd.addColorStop(1, rgbaString(c, 0));
                  ctx.lineCap = 'round';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(n.x, n.y);
                  ctx.strokeStyle = grd;
                  ctx.lineTo(point.x, point.y);
                  ctx.closePath();
                  ctx.stroke();
                  ctx.restore();
                }
              }

              ctx.drawImage(particler(c.r, c.g, c.b, 1),
                n.x - r / 2, n.y - r / 2, r, r);

            }, this);
        }
      },

      // Draw the provided links
      // A link: {source: _, target: _, color: _, width: _}
      // source/target: {x: _, y: _, strokeStyle: _, fillStyle: _}
      links: {
        active: true,
        order: -1,
        data: [],

        draw: function (context) {
          var pi = Math.PI;

          for (var i = 0; i < this.data.length; i++) {
            context.beginPath();
            context.strokeStyle = this.data[i].color;
            context.moveTo(this.data[i].source.x, this.data[i].source.y);
            context.lineTo(this.data[i].target.x, this.data[i].target.y);
            context.lineWidth = this.data[i].width;
            context.lineCap = "round";
            context.stroke();

            context.lineWidth = 2;
            context.beginPath();
            context.arc(this.data[i].source.x, this.data[i].source.y,
              this.data[i].source.r || 5, 0, pi * 2);
            if (this.data[i].source.fillStyle) {
              context.fillStyle = this.data[i].source.fillStyle;
              context.fill();
            }
            if (this.data[i].source.strokeStyle) {
              context.strokeStyle = this.data[i].source.strokeStyle;
              context.stroke();
            }

            context.beginPath();
            context.fillStyle = this.data[i].target.fillStyle || "#fff";
            context.arc(this.data[i].target.x, this.data[i].target.y,
              this.data[i].target.r || 5, 0, pi * 2);
            if (this.data[i].target.fillStyle) {
              context.fillStyle = this.data[i].target.fillStyle;
              context.fill();
            }
            if (this.data[i].target.strokeStyle) {
              context.strokeStyle = this.data[i].target.strokeStyle;
              context.stroke();
            }
          }
        }
      }

    },

    // State
    _activeCanvas: {
      canvas: canvas,
      context: canvas.node().getContext("2d")
    },

    _clearContext: function (context) {
      context.save();
      context.clearRect(0, 0, width, height);
      context.restore();
    },

    _drawSort: function (d1, d2) {
      return d1.order || 0 - d2.order || 0;
    },

    redraw: function () {
      this.drawStart = new Date().getTime();

      // Draw the active drawings
      this._clearContext(this._activeCanvas.context);

      for (var drawing in this.drawings) {
        if (this.drawings[drawing].active) {
          this.drawings[drawing].draw(this._activeCanvas.context);
        }
      }

      var that = this;

      var nextFrame = 1000 / 30 - (new Date().getTime() - this.drawStart);

      if (nextFrame < 0) nextFrame = 0;

      this._timeout = setTimeout(function () {
        that.redraw()
      }, nextFrame);
    },

    start: function (interval) {
      this.redraw();
    },

    stop: function () {
      clearTimeout(this._timeout);
    }
  };

  // Event handling for setting the painter's links
  var _ = (function () {
    var previous;

    function cityKey(n) {
      return [n.country, n.city];
    }

    canvas.on("mousemove", function () {
      // TODO -- this is a hacky mess
      var nearestOrigin = linkModels.origins.pixelsFromNearest(d3.mouse(this)),
        nearestTarget = linkModels.targets.pixelsFromNearest(d3.mouse(this)),
        nearest, msg, model, mapfn, strokeOrigin, strokeTarget;
      if (nearestOrigin || nearestTarget) {
        if (!nearestTarget || nearestOrigin.distance <= nearestTarget.distance) {
          nearest = nearestOrigin;
          msg = "Attacks originating from: ";
          model = linkModels.origins;
          strokeOrigin = true;
        }
        if (!nearestOrigin || nearestTarget.distance < nearestOrigin.distance) {
          nearest = nearestTarget;
          msg = "Attacks targeting: ";
          model = linkModels.targets;
          strokeTarget = true;
        }
      }

      if (nearest && nearest.distance < 20) {
        var key = cityKey(nearest);
        if (key !== previous) {
          painter.drawings.links.data =
            model.cityToLinks(nearest, strokeOrigin, strokeTarget);
          displayLabel.set(msg +
            (nearest.city === "" ? "<unknown>" : nearest.city)
            + ", " + countryModel.getByIso2(nearest.country).country);
        }
      } else {
        previous = key;
        painter.drawings.links.data.length = 0;
        displayLabel.clear();
      }
    });
  })();

  /*
   * The legend
   */
  (function(){
    var legend = d3.select("#legend-container")
      .append("div")
      .attr("id", "legend");

    var attack = legend.append("div"),
      width = 20, height = 20;
    attack.append("h4").text("每个粒子代表一个攻击");
    attack.append("canvas")
      .attr("width", width * 2)
      .attr("height", height * 2)
      .node().getContext("2d")
      .drawImage(particler(255, 255, 255, 1),
      width / 2, height / 2, width, height);

    var clusters = legend.append("div").attr("class", "clusters");
    clusters.append("h4").text("这是攻击来源");

    var height = 30;
    var clusterList = clusters.append("ul").selectAll("li")
      .data([1, 10, 200])
      .enter().append("li");
    clusterList.append("svg")
      .style("width", function(d) { return circleScale(d) * 2; })
      .style("height", height)
      .append("circle")
      .attr("fill", "white")
      .attr("cy", function(d) { return height - circleScale(d); })
      .attr("cx", function(d) { return circleScale(d); })
      .attr("r", function(d) { return circleScale(d); });
    clusterList.append("p")
      .text(function(d) { return d; });

    var countryColors = legend.append("div").attr("class", "country-colors");
    countryColors.append("h4").text("这是被攻击国家");

    var r = 4;
    var countryColorList = countryColors.append("ul").selectAll("li")
      .data([1, 5, 25, 100, 500])
      .enter().append("li");
    countryColorList.append("svg")
      .style("width", r * 2)
      .style("height", r * 2)
      .append("circle")
      .attr("fill", function(d) { return settings.countryColor(d); })
      .attr("cy", r)
      .attr("cx", r)
      .attr("r", r);
    countryColorList.append("p")
      .text(function(d) { return d; });
  })(window);

/*
 * Stats the state machine
 */
function Stats(params) {
  this.state = params.state || d3.map();
  this.elt = params.elt || d3.select("body");
  this.tag = params.tag || "div";

  this.insert = function (incoming) {
    // Insert a new item, updating the state. params.insert should mutate
    params.insert(incoming, this.state);
  };

  this.data = function () {
    // Get the data as a list
    if (params.data) return params.data(this.state); else this.state;
  }

  this.redraw = function () {
    if (params.redraw) {
      params.redraw()
    } else {
      this.elt.selectAll(this.tag)
        .data(this.data())
        .enter().append(this.tag)
        .text(function (d) {
          return d
        });
    }
  }
}


var statsManager = {
  insert: function (incoming) {
    for (var i = 0; i < this.stats.length; ++i) {
      this.stats[i].insert(incoming);
    }
  },

  redraw: function () {
    for (var i = 0; i < this.stats.length; i++) {
      this.stats[i].redraw();
    }
  },

  stats: [
    new Stats({
      // Color countries
      state: {sources: {}, targets: {}},

      insert: function (d, state) {
        function pushState(m, key) {
          if (key in m) {
            m[key] = m[key] + 1;
          } else {
            m[key] = 1;
          }
        }

        //pushState(state.sources, d.country);
        pushState(state.targets, d.country2);

        //d3.select("#" + d.country)
        //    .attr("fill", d3.rgb(colorScale(state.sources[d.country]), 0, 0).toString());
        d3.select("#" + d.country2)
          .attr("fill", settings.countryColor(state.targets[d.country2]));
      },

      redraw: function () {
      }
    }),

    // Origin data table
    new Stats({
      state: d3.map(),

      insert: function (incoming, state) {
        this.updated = incoming.country;
        if (state.has(incoming.country)) {
          state.set(incoming.country,
            state.get(incoming.country) + 1);
        } else {
          state.set(incoming.country, 1);
        }
      },

      redraw: function () {
        var data = this.state.entries()
            .sort(function (d1, d2) {
              return d2.value - d1.value;
            })
            .slice(0, settings.topTableRows),
          updated = this.updated;

        var rows = d3.select("#left-data").selectAll("tr.row")
          .data(data, function (d) {
            return d.key;
          });
        rows.enter()
          .append("tr")
          .attr("class", "row")
          .on("mouseenter", function (d) {
            var country = countryModel.getByIso2(d.key);
            displayLabel.set("Attacks originating from: " +
              (country ? country.country : d.key));

            // On mouseenter, use all country data to create links
            painter.drawings.links.data =
              linkModels.origins.getCountry(d.key)
                .reduce(function (acc, city) {
                  return acc.concat(
                    linkModels.origins.cityToLinks(
                      city, true, false));
                }, []);
          })
          .on("mouseleave", function () {
            displayLabel.clear();
          });
        rows.sort(function (d1, d2) {
          return d2.value - d1.value;
        });
        rows.exit().remove();

        rows.filter(function (d) {
          return d.key == updated
        })
          .style("color", settings.triggerColor)
          .transition()
          .duration(1000)
          .style("color", "white");

        var cols = rows.selectAll("td")
          .data(function (d) {
            var country = countryModel.getByIso2(d.key);
            return [
              '<div class="bar" style="width: ' +
              settings.tableBarWidth(d.value + 1) + '"></div>',
              spanWrap(d.value, ["numeric"]),
              flagTag(d.key),
              (country ? country.country : d.key)];
          });
        cols.enter().append("td");
        cols.html(function (d) {
          return d;
        });
        cols.exit().remove();
      }
    }),

    // Targeted data table
    new Stats({
      state: d3.map(),

      insert: function (incoming, state) {
        this.updated = incoming.country2;
        if (state.has(incoming.country2)) {
          state.set(incoming.country2,
            state.get(incoming.country2) + 1);
        } else {
          state.set(incoming.country2, 1);
        }
      },

      redraw: function () {
        var data = this.state.entries()
            .sort(function (d1, d2) {
              return d2.value - d1.value;
            })
            .slice(0, settings.topTableRows),
          updated = this.updated;

        var rows = d3.select("#right-data").selectAll("tr.row")
          .data(data, function (d) {
            return d.key;
          });
        rows.enter()
          .append("tr")
          .attr("class", "row")
          .on("mouseenter", function (d) {
            var country = countryModel.getByIso2(d.key);
            displayLabel.set("Attacks targeting: " +
              (country ? country.country : d.key));

            // On mouseenter, use all country data to create links
            painter.drawings.links.data =
              linkModels.targets.getCountry(d.key)
                .reduce(function (acc, city) {
                  return acc.concat(
                    linkModels.targets.cityToLinks(
                      city, false, true));
                }, []);
          })
          .on("mouseleave", function () {
            displayLabel.clear();
          });
        rows.sort(function (d1, d2) {
          return d2.value - d1.value;
        });
        rows.exit().remove();

        rows.filter(function (d) {
          return d.key == updated
        })
          .style("color", "blue")
          .transition()
          .duration(1000)
          .style("color", "white");

        var cols = rows.selectAll("td")
          .data(function (d) {
            var country = countryModel.getByIso2(d.key);
            return [
              '<div class="bar" style="width: ' +
              settings.tableBarWidth(d.value + 1) + '"></div>',
              spanWrap(d.value, ["numeric"]),
              flagTag(d.key),
              (country ? country.country : d.key)];
          });
        cols.enter().append("td");
        cols.html(function (d) {
          return d;
        });
        cols.exit().remove();
      }
    }),

    new Stats(
      {
        state: d3.map(),

        insert: function (incoming) {
          this.updated = incoming.dport;
          if (this.state.has(incoming.dport)) {
            this.state.set(incoming.dport,
              this.state.get(incoming.dport) + 1);
          } else {
            this.state.set(incoming.dport, 1);
          }
        },

        redraw: function () {
          var data = this.state.entries()
              .sort(function (d1, d2) {
                return d2.value - d1.value;
              })
              .slice(0, settings.portTableRows),
            updated = this.updated;

          var rows = d3.select("#bottom-right-data").selectAll("tr.row")
            // XXX - I'm not sure why d is undef the first time through.
            .data(data, function (d, i) {
              return d ? d.key : i;
            });
          rows.enter()
            .append("tr")
            .attr("class", "row")
            .on("mouseenter", function (d) {
              var port = ports[d.key];
              displayLabel.set("Attacks made over: " +
                (port ? port : "unknown") +
                " [" + d.key + "]");
              painter.drawings.links.data =
                linkModels.origins.dPortLinks(d.key).map(function (c) {
                  var r = circleScale(c.count),
                    color = colorizer(c.dport);
                  return {
                    source: {
                      x: c.source.pt[0],
                      y: c.source.pt[1],
                      fillStyle: color,
                      r: r
                    },
                    target: {
                      x: c.target.pt[0],
                      y: c.target.pt[1],
                      strokeStyle: color,
                      r: r
                    },
                    width: lineScale(c.count),
                    color: colorizer(c.dport)
                  }
                });
            })
            .on("mouseleave", function (d) {
              displayLabel.clear();
            })
          rows.sort(function (d1, d2) {
            return d2.value - d1.value;
          });
          rows.exit().remove();

          rows.filter(function (d) {
            return d.key == updated
          })
            .style("color", function (d) {
              return colorizer(d.key);
            })
            .transition()
            .duration(1000)
            .style("color", "white");

          var cols = rows.selectAll("td")
            .data(function (d) {
              return [
                '<div class="bar" style="width: ' +
                settings.tableBarWidth(d.value + 1) + '"></div>',
                spanWrap(d.value, ["numeric"]),
                '<span class="port-circle" style="color:' + colorizer(d.key) +
                '">●</span>',
                ports[d.key] ? ports[d.key] : "unknown",
                spanWrap(d.key, ["numeric"])
              ];
            });
          //function(d) { return d; });
          cols.enter().append("td");
          cols.html(function (d) {
            return d;
          });
          cols.exit().remove();
        }
      }),

    new Stats({
      // #console stats manager
      state: [],

      insert: function (incoming, state) {
        state.push(incoming);
        while (state.length > settings.consoleTableRows) {
          state.shift();
        }
        return state;
      },

      redraw: function () {
        var that = this;
        var rows = d3.select("#events-data").selectAll("tr.row")
          .data(this.state, function (d) {
            return d.id;
          });

        rows.enter().append("tr")
          .style("color", function (d) {
            return colorizer(d.dport);
          })
          .attr("class", "row");
        rows.exit().remove();

        var cols = rows.selectAll("td")
          .data(function (d) {
            return [
              d.datetime,
              spanWrap(d.org, ["org", "overflow"]),
              spanWrap(
                (d.city === "" ? "unknown" : d.city) + ", " +
                countryModel.getByIso2(d.country).country,
                ["location", "overflow"]),
              d.md5,
              spanWrap(
                (d.city2 === "" ? "unknown" : d.city2) + ", " +
                countryModel.getByIso2(d.country2).country,
                ["location", "overflow", "numeric"]),
              spanWrap(d.service || "unknown",
                ["service", "overflow"]),
              spanWrap(d.dport, ["numeric"])];
          });
        cols.enter().append("td")
          .html(function (d) {
            return d;
          });
        cols.exit().remove();
      }

    })
  ]
};

// Keep track of the rate
var rateTicker = {
  data: [],
  interval: 90000,
  graph: d3.select("#content")
    .append("svg")
    .attr("id", "rate-graph"),
  x: d3.time.scale().range([800, 0]),
  opacity: d3.time.scale().range([0, 1]),

  push: function (d) {
    this.data.push({date: Date.now(), key: d.dport});
  },

  clean: function (toDate) {
    // Clean out old data
    while (this.data.length > 0 && this.data[0].date < toDate) {
      this.data.shift();
    }
  },

  step: function () {
    var that = this,
      now = Date.now(),
      range = [now - this.interval, now];
    this.clean(range[0]);
    this.x.domain(range);
    this.opacity.domain(range);

    var simpleLine = function (h) {
      return function (d) {
        var cx = that.x(d.date);
        return d3.svg.line()([[cx, 0], [cx, h || 20]])
      }
    };
    var ticks = this.graph.selectAll("path.tick")
      .data(this.data, function (d) {
        return d.date;
      });

    ticks.enter().append("path")
      .attr("class", "tick")
      .attr("d", simpleLine())
      .style("stroke", function (d) {
        return colorizer(d.key);
      });

    ticks.exit().remove();

    ticks
      //.transition().duration(30)
      .attr("d", simpleLine())
      .style("opacity", function (d) {
        return that.opacity(d.date);
      });
  },

  start: function () {
    var that = this;
    setInterval(function () {
      that.step();
    }, 50);
  }
};


var wsDiscTime = 0;

function start(loc, psk) {
  var webSocket = new WebSocket(loc || settings.wsHost);

  var pauser = {
    elt: d3.selectAll(".controls"),
    _buffer: [],

    unbuffer: function (d) {
      while (this._buffer.length > 0) {
        this.insert(this._buffer.shift());
      }
      statsManager.redraw();
    },

    insert: function (d) {
      nodeModel.pushAttack(d);
      statsManager.insert(d);
      for (var model in linkModels) {
        linkModels[model].insert(d);
      }
      rateTicker.push(d);

      d.pruneTS = new Date().getTime() / 1000 + settings.pruneInterval;
      timestampedData.push(d);
    },

    push: function (d) {
      if (this.paused()) {
        this._buffer.push(d);
      } else {
        this.insert(d);
        statsManager.redraw();
      }
    },

    paused: function () {
      return this.elt.node().dataset.paused === "true";
    },

    toggle: function () {
      var dataset = this.elt.node().dataset;
      var button = d3.selectAll(".play-pause");

      if (this.paused()) {
        button.classed("icon-play", false);
        button.classed("icon-pause", true);
        this.elt.node().dataset.paused = "false";
        this.unbuffer();
      } else {
        button.classed("icon-pause", false);
        button.classed("icon-play", true);
        this.elt.node().dataset.paused = "true";
      }
    }
  };
  pauser.elt.on("click", function () {
    pauser.toggle();
  });

  webSocket.onopen = function () {
    wsDiscTime = 0;
    d3.select("#events-data").selectAll("tr.row").remove();
    webSocket.send(psk || settings.psk);
  };

  webSocket.onmessage = function (evt) {
    if (!evt) {
      return;
    }

    // Parse the json to a js obj and clean the data
    var datum = eval("(" + evt.data + ")");

    if (datum.longitude == 0 && datum.latitude == 0) {
      datum.longitude = -5;
      datum.latitude = -50;
    }

    var startLoc = projection([datum.longitude, datum.latitude]);
    var endLoc = projection([datum.longitude2, datum.latitude2]);

    if (datum.error) {
      showMessage("ERROR: " + datum.error.msg);
    }

    for (var prop in datum) {
      if (settings.numberProps.indexOf(prop) !== -1) {
        datum[prop] = Number(datum[prop]);
      }
    }

    function cleanCountry(country) {
      // Clean incoming country code
      if (country === "USA") {
        return "US";
      }
      return country
    }

    datum.country = cleanCountry(datum.country);
    datum.country2 = cleanCountry(datum.country2);

    datum.service = datum.dport in ports ? ports[datum.dport] : undefined;
    datum.cx = startLoc[0];
    datum.cy = startLoc[1];
    datum.x = startLoc[0];
    datum.y = startLoc[1];
    datum.targetX = endLoc[0];
    datum.targetY = endLoc[1];
    datum.id = getID();
    datum.datetime = (new Date()).toISOString()
      .replace("T", "&ensp;")
      .slice(0, -2);

    pauser.push(datum);
  };

  webSocket.onclose = function () {
    //try to reconnect in 5 seconds
    var interval = 500;

    wsDiscTime += 500;

    d3.select("#events-data").selectAll("tr.row").remove();
    d3.select("#events-data").append("tr").attr('class', 'row').html("<td colspan='7'><img src='images/loading.gif' style='margin-top: 6px;'/>&nbsp;<span style='display: inline-block; height: 25px; vertical-align: middle;'>Loading...</span></td>");

    if (wsDiscTime > settings.wsTimeout) {
      showMessage("We are having difficulties in the WebSocket connectivity. We will continue trying...");
      wsDiscTime = 0;
    }

    setTimeout(function () {
      console.log("websocket closed, reconnecting in " + interval + "ms");
      start(loc, psk);
    }, interval);
  };

  return webSocket;
}

/*
 * Load external data, and manage loading state
 */

queue()
  .defer(d3.json, "data/readme-world.json")
  .defer(d3.tsv, "data/port-names.tsv")
  .defer(d3.csv, "data/country-codes.csv")
  .await(function (error, world, rawPorts, countryCodes) {
    // Update the countryModel
    countryModel.set(countryCodes);
    countryModel.push({iso2: "O1", country: "Mil/Gov"});

    // Temporary mapping to key the map
    var mapCodes = {};
    countryCodes.forEach(function (d) {
      mapCodes[Number(d.isonum)] = d.iso2;
    });

    // Enter the countries
    svg.append("g")
      .attr("class", "world")
      .selectAll("path")
      .data(topojson.feature(world, world.objects.countries).features)
      .enter().insert("path")
      .attr("class", "country")
      .attr("id", function (d) {
        return mapCodes[d.id];
      })
      .attr("fill", settings.countryColor(0))
      .attr("d", path);

    ports = parsePorts(rawPorts);

    loadingToggle();
    var webSocket = start();
    nodeModel.start();
    painter.start();
    rateTicker.start();
  });

// Export the external API
window.IPViking = {
  settings: settings
};

var unknownLoc = projection([-5, -50]);

d3.selectAll("#unknown-icon").style({'left': unknownLoc[0] - 18, 'top': unknownLoc[1] - 18});

setInterval(function () {
  prune();
}, 30000);
})(window);
