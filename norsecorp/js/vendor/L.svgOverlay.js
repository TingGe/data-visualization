// FIXME can we just wipe this entire thing and scrap the mover-updating code for free?
//       see: http://bl.ocks.org/monfera/11100987
var SVGOverlay = L.Class.extend({

  initialize: function (options) {
    // save position of the layer or any options from the constructor
    // this._latlng = latlng;
    L.setOptions(this, options);
  },

  onAdd: function (map) {
    this._map = map;

    // initialize the map SVG layer if it doesn't exist
    if (!map._svgLayer) {
      map._initPathRoot();
      map._svgLayer = d3.select(map._container).select('svg');
    }

    this._defs = map._svgLayer.append('defs');

    // create a DOM element and put it into one of the map panes
    // this._el = L.DomUtil.create('svg', 'my-custom-layer leaflet-zoom-hide');
    this.el = map._svgLayer.append('g')
      .datum(this.options)
      .classed('leaflet-zoom-hide', true);
    // map.getPanes().overlayPane.appendChild(this._el);


    // add a viewreset event listener for updating layer's position, do the latter
    map.on('viewreset', this._reset, this);
    this._reset();
  },

  onRemove: function (map) {
    // remove layer's DOM elements and listeners
    // map.getPanes().overlayPane.removeChild(this._el);
    this.el.remove();
    map.off('viewreset', this._reset, this);
  },

  _reset: function () {
    // update layer's position
    var pos = this._map.latLngToLayerPoint(this.options.center);
    L.DomUtil.setPosition(this.el, pos);
  }
});

// map.addLayer(new MyCustomLayer(latlng));
