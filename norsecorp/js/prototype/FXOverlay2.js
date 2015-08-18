L.FXOverlay = L.Class.extend({

    initialize: function (userDrawFunc, bounds, options) {
        this._userDrawFunc = userDrawFunc;
        this._bounds = L.latLngBounds(bounds);
        L.setOptions(this, options);
    },

    drawing: function (userDrawFunc) {
        this._userDrawFunc = userDrawFunc;
        return this;
    },

    params:function(options){
        L.setOptions(this, options);
        return this;
    },
    
    canvas: function () {
        return this._canvas;
    },

    context: function () {
        return this._context;
    },

    redraw: function () {
        if (!this._frame) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    
  
    onAdd: function (map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
        this._context = this._canvas.getContext('2d');

        var size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(this._canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));


        map._panes.overlayPane.appendChild(this._canvas);

        map.on('moveend', this._reset, this);
        map.on('resize',  this._resize, this);

        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._reset();
    },

    onRemove: function (map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
 
        map.off('moveend', this._reset, this);
        map.off('resize', this._resize, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
        this_canvas = null;

    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _resize: function (resizeEvent) {
        this._canvas.width  = resizeEvent.newSize.x;
        this._canvas.height = resizeEvent.newSize.y;
    },
    // _reset: function () {
    //     // var pos = L.DomUtil.getPosition(this._map.getPanes().mapPane);
    //     // if (pos) {
    //     //   L.DomUtil.setPosition(this._canvas, { x: -pos.x, y: -pos.y });
    //     // }

    //     // var topLeft = this._map.containerPointToLayerPoint([0, 0]);
    //     // L.DomUtil.setPosition(this._canvas, topLeft);

    //     this._redraw();
    // },

    _redraw: function () {
        var size     = this._map.getSize();
        var bounds   = this._map.getBounds();
        // var zoomScale = (size.x * 180) / (20037508.34  * (bounds.getEast() - bounds.getWest())); // resolution = 1/zoomScale
        var zoom = this._map.getZoom();
     
        // console.time('process');

        if (this._userDrawFunc) {
            this._userDrawFunc(this,
                                {
                                    canvas   :this._canvas,
                                    context: this._context,
                                    bounds   : bounds,
                                    size     : size,
                                    // zoomScale: zoomScale,
                                    zoom : zoom,
                                    options: this.options
                               });
        }
       
       
        // console.timeEnd('process');
        
        this._frame = null;
    },

      _animateZoom: function (e) {
        var bounds = new L.Bounds(
          this._map._latLngToNewLayerPoint(this._bounds.getNorthWest(), e.zoom, e.center),
          this._map._latLngToNewLayerPoint(this._bounds.getSouthEast(), e.zoom, e.center));

        var offset = bounds.min.add(bounds.getSize()._multiplyBy((1 - 1 / e.scale) / 2));

        L.DomUtil.setTransform(this._canvas, offset, e.scale);
        // this._canvas.scale(e.scale);
      },

      _reset: function () {
        var image = this._canvas,
            bounds = new L.Bounds(
                this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
                this._map.latLngToLayerPoint(this._bounds.getSouthEast())),
            size = bounds.getSize();

        L.DomUtil.setPosition(image, bounds.min);

        image.style.width  = size.x + 'px';
        image.style.height = size.y + 'px';
      },

    // _animateZoom: function (e) {
    //     var scale = this._map.getZoomScale(e.zoom),
    //         offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

    //     this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';

    // }
});

L.fxOverlay = function (userDrawFunc, bounds, options) {
    return new L.FXOverlay(userDrawFunc, bounds, options);
};
