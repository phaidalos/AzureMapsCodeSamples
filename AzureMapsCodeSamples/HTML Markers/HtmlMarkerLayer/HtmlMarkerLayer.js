/**
 * A layer that renders point data from a data source as HTML elements on the map.
 */
class HtmlMarkerLayer extends atlas.layer.BubbleLayer {
    /**
    * Constructs a new HtmlMarkerLayer.
    * @param source The id or instance of a data source which the layer will render.
    * @param id The id of the layer. If not specified a random one will be generated.
    * @param options The options of the Html marker layer.
    */
    constructor(source, id, options) {
        super(source, id, {
            color: 'transparent',
            radius: 1,
            strokeWidth: 0
        });
        this._options = {
            sourceLayer: undefined,
            source: undefined,
            filter: undefined,
            minZoom: 0,
            maxZoom: 24,
            visible: true,
            markerRenderCallback: (id, position, properties) => {
                return new atlas.HtmlMarker({
                    position: position
                });
            },
            clusterRenderCallback: (id, position, properties) => {
                return new atlas.HtmlMarker({
                    position: position,
                    text: properties.point_count_abbreviated
                });
            }
        };
        this._markers = [];
        this._markerIds = [];
        this._sourceShapeCount = 0;
        this._datasourceCache = null;
        this._optionsChanged = false;
        this._markerCache = {};
        this.setOptions(options);
    }
    /**
    * Gets the options of the Html Marker layer.
    */
    getOptions() {
        return this._options;
    }
    /**
     * Gets the source provided when creating the layer.
     */
    getSource() {
        return super.getSource();
    }
    /**
    * Sets the options of the Html marker layer.
    * @param options The new options of the Html marker layer.
    */
    setOptions(options) {
        var newBaseOptions = {};
        if (options.source && this._options.source !== options.source) {
            this._options.source = options.source;
            newBaseOptions.source = options.source;
            this.clearCache();
        }
        if (options.sourceLayer && this._options.sourceLayer !== options.sourceLayer) {
            this._options.sourceLayer = options.sourceLayer;
            newBaseOptions.sourceLayer = options.sourceLayer;
            this.clearCache();
        }
        if (options.filter && this._options.filter !== options.filter) {
            this._options.filter = options.filter;
            newBaseOptions.filter = options.filter;
            this.clearCache();
        }
        if (typeof options.minZoom === 'number' && this._options.minZoom !== options.minZoom) {
            this._options.minZoom = options.minZoom;
            newBaseOptions.minZoom = options.minZoom;
        }
        if (typeof options.maxZoom === 'number' && this._options.maxZoom !== options.maxZoom) {
            this._options.maxZoom = options.maxZoom;
            newBaseOptions.maxZoom = options.maxZoom;
        }
        if (typeof options.visible !== 'undefined' && this._options.visible !== options.visible) {
            this._options.visible = options.visible;
            newBaseOptions.visible = options.visible;
        }
        if (options.markerRenderCallback && this._options.markerRenderCallback != options.markerRenderCallback) {
            this._options.markerRenderCallback = options.markerRenderCallback;
            this.clearCache();
        }
        if (options.clusterRenderCallback && this._options.clusterRenderCallback != options.clusterRenderCallback) {
            this._options.clusterRenderCallback = options.clusterRenderCallback;
            this.clearCache();
        }
        this._optionsChanged = true;
        super.setOptions(newBaseOptions);
    }
    //TODO: Update this once map supports layer added/removed events and layers support getMap function.
    _setMap(map) {
        if (this._map) {
            this._map.events.remove('moveend', () => { this.updateMarkers(); });
            this._map.events.remove('render', () => { this.checkLayerForChanges(); });
        }
        this._map = map;
        this._map.events.add('moveend', () => { this.updateMarkers(); });
        this._map.events.add('render', () => { this.checkLayerForChanges(); });
        //Call the underlying functionaly for this.
        super['_setMap'](map);
    }
    //TODO: Update this when data source supports updated events.
    checkLayerForChanges() {
        if (this._map) {
            var s = this.getSource();
            if (typeof s === 'string') {
                s = this._map.sources.getById(s);
            }
            var opt = null;
            var datasourceChanged = false;
            if (s instanceof atlas.source.DataSource) {
                opt = JSON.stringify(s.getOptions());
                if (this._sourceShapeCount !== s['shapes'].length) {
                    this._sourceShapeCount = s['shapes'].length;
                    datasourceChanged = true;
                }
                else {
                    var d = JSON.stringify(s.toJson());
                    if (d !== this._datasourceCache) {
                        this._datasourceCache = d;
                        datasourceChanged = true;
                    }
                }
            }
            else if (s instanceof atlas.source.VectorTileSource) {
                opt = JSON.stringify(s.getOptions());
            }
            //Check to see if any changes have occured to the data source.
            if (datasourceChanged || opt != this._sourceOptions) {
                this._sourceOptions = opt;
                this.clearCache();
            }
            this.updateMarkers();
        }
    }
    clearCache() {
        //Give data source a moment to update.
        setTimeout(() => {
            this._markerCache = {}; //Clear marker cache.  
            this._map.markers.remove(this._markers);
            this._markers = [];
            this._markerIds = [];
            this.updateMarkers();
        }, 100);
    }
    updateMarkers() {
        if (this._map && this._map.getCamera().zoom >= this._options.minZoom && this._map.getCamera().zoom <= this._options.maxZoom) {
            var shapes = this._map.layers.getRenderedShapes(null, [this], this._options.filter);
            var newMarkers = [];
            var newMarkerIds = [];
            var id;
            var properties;
            var position;
            var shape;
            var feature;
            var marker;
            for (var i = 0, len = shapes.length; i < len; i++) {
                marker = null;
                if (shapes[i] instanceof atlas.Shape) {
                    shape = shapes[i];
                    if (shape.getType() === 'Point') {
                        position = shape.getCoordinates();
                        properties = shape.getProperties();
                        id = shape.getId();
                    }
                }
                else {
                    feature = shapes[i];
                    if (feature.geometry.type === 'Point') {
                        position = feature.geometry.coordinates;
                        properties = feature.properties;
                        if (properties && properties.cluster) {
                            id = 'cluster_' + feature.properties.cluster_id;
                        }
                        else if (feature.id) {
                            id = feature.id;
                        }
                    }
                }
                if (position) {
                    marker = this.getMarker(id, position, properties);
                    if (marker) {
                        if (marker.id) {
                            newMarkerIds.push(marker.id);
                        }
                        if (!marker.id || this._markerIds.indexOf(marker.id) === -1) {
                            newMarkers.push(marker);
                            this._map.markers.add(marker);
                        }
                    }
                }
            }
            //Remove all markers that are no longer in view. 
            for (var i = this._markers.length - 1; i >= 0; i--) {
                if (!this._markers[i].id || newMarkerIds.indexOf(this._markers[i].id) === -1) {
                    this._map.markers.remove(this._markers[i]);
                    this._markers.splice(i, 1);
                }
            }
            this._markers = this._markers.concat(newMarkers);
            this._markerIds = newMarkerIds;
        }
    }
    getMarker(id, position, properties) {
        //Check cache for existing marker.
        if (this._markerCache[id]) {
            return this._markerCache[id];
        }
        else {
            var m;
            if (properties && properties.cluster) {
                if (this._options.clusterRenderCallback && typeof properties.cluster_id === 'number') {
                    m = this._options.clusterRenderCallback(id, position, properties);
                }
            }
            else if (this._options.markerRenderCallback) {
                m = this._options.markerRenderCallback(id, position, properties);
            }
            if (m) {
                m.properties = properties;
                m.id = id;
                //Make sure position is set.
                m.setOptions({
                    position: position
                });
                this._markerCache[id] = m;
                return m;
            }
            return null;
        }
    }
}
/**
 * //TODO: Future improvements
 *  - Add support for layer level events
 *  - Add support for points in shapes (i.e. polygons), similar to how symbol layer works.
 */ 
//# sourceMappingURL=HtmlMarkerLayer.js.map