(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    /*
    NOTE: There has been a change in terminology between Cartograph v1 and Cartograph v2 (current version); due to
    retrocompatibility reasons, the old terminology is still used in the map data structure, and therefore you will
    encounter references to it in the code.
    - A "layer" (a group of datasets that you can show/hide and document) is now a "layer group"
    - An "active dataset" is now a "layer"
     */

    /* Migration note (for Cartograph)
      "activeDatasets": [
        {
          "searchParameters": {},
          "color": "#C32D1C",
          "expr": "id_geofla",
          "picto": "icon-circle",
          "clusterMode": "polygon",
          "func": "COUNT",
          "marker": true,
          "datasetid": "geoflar-communes-2"
        },

        BECOMES
      "activeDatasets": [
        {
          "context": <context>
          "color": "#C32D1C",
          "expr": "id_geofla",
          "picto": "icon-circle",
          "clusterMode": "polygon",
          "func": "COUNT",
          "marker": true,
        },

     When persisting, the context can be serialized as a datasetid and searchparameters. We trust Cartograph to make the
     transformation in both direction.
     */
    mod.directive('odsMap', ['MapHelper', 'ModuleLazyLoader', 'ODSWidgetsConfig', 'MapLayerRenderer', 'translate', '$q', '$timeout', function(MapHelper, ModuleLazyLoader, ODSWidgetsConfig, MapLayerRenderer, translate, $q, $timeout) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsMap
         * @scope
         * @restrict E
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {Object} [mapContext] An object where the `location` and `basemap` selection is kept. You can use it from
         * anither widget to read the location or basemap.
         * @param {string} [location] The default location of the map upon initialization, under the following format: "zoom,latitude,longitude".
         * For example, to have a map centered on Paris, France, you can use "12,48.85218,2.36996". By default, if a location is not specified,
         * the map will try to fit all the displayed data when initializing.
         * @param {string} [basemap] The identifier of the basemap to use by default, as defined in {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.basemaps}. By default,
         * the first available basemap will be used.
         * @param {boolean} [staticMap] If "true", then users won't be able to move or zoom on the map. They will still be able to click on markers.
         * @param {boolean} [noRefit] By default, the map refits its view whenever the displayed data changes.
         * If "true", then the map will stay at the same location instead.
         * @param {boolean} [toolbarGeolocation=true] If "false", then the "geolocate" button won't be displayed in the map's toolbar.
         * @param {boolean} [toolbarDrawing=true] If "false", then the drawing tools (to draw filter areas) won't be displayed in the map's toolbar.
         * @param {boolean} [toolbarFullscreen=true] If "false", then the "go fullscreen" button won't be displayed in the map's toolbar.
         * @description
         * This widget allows you to build a map visualization and show data using various modes of display using layers.
         * Each layer is based on a {@link ods-widgets.directive:odsDatasetContext Dataset Context}, a mode of display (clusters...), and various properties to define the
         * display itself, such as colors.
         *
         * Layers can be combined, so that you map shows various data sources in various ways.
         *
         * Layers are dynamic, which means that if a context changes (e.g. a new refine is added), the layer will be refreshed and display the new relevant data.
         *
         * This widget can also be used to control other widgets: you can configure a layer to act as a refine control on another context, so that for example
         * if you click on a road you get a {@link ods-widgets.directive:odsTable table view} of the traffic on that road. You can also draw zones on the map,
         * which will accordingly refine the context.
         *
         * You can use the widget alone to propose a simple map using default settings, such as this:
         * <pre>
         *     <!-- Displays a map of Paris using the data from mycontext and an automatic visualization mode (clusters or shapes depending on the zoom level) -->
         *     <ods-map context="mycontext" location="12,48.85218,2.36996"></ods-map>
         * </pre>
         *
         * However, the ability to build a more advanced and configurable map comes with a second `odsMapLayer` tag, used to define a layer:
         *
         * <pre>
         *     <!-- A map containing a single layer to display data from mycontext, in a specific color, and as clusters. -->
         *     <ods-map>
         *         <ods-map-layer context="mycontext" color="#FF0000" display="clusters"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * You can have several layers, each with their own configuration and context:
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" color="#FF0000" display="clusters"></ods-map-layer>
         *         <ods-map-layer context="mycontext2" display="heatmap"></ods-map-layer>
         *         <ods-map-layer context="mycontext3" display="raw" color="#0000FF"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * You can show or hide layers using the `showIf` property, similar to Angular's `ngIf`.
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" color="#FF0000" display="clusters"></ods-map-layer>
         *         <ods-map-layer context="mycontext2" display="heatmap" show-if="showHeatmap"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * Several display modes are available, under two categories: visualization of the data itself (each point is a record),
         * and visualization of an aggregation of data (each point is the result of an aggregation function).
         *
         * - `auto`: depending on the number of points and the type of geometry, the best display mode is automatically chosen. This is the default display
         * mode, and makes sense mot of the time of you want to simply represent geo data.
         * - `raw`: data is downloaded and displayed directly as is, with no clustering or simplification of any kind. Do not
         * use on large (1000+) datasets, as it may freeze the user's browser.
         * - `clusters`: data is aggregated spatially into clusters; each cluster represents two or more "close" points. When at maximum
         * zoom, all points are shown.
         * - `clustersforced`: data is aggregated spatially into clusters, but the number on the cluster is the result of an aggregation function.
         * - `heatmap`: data is displayed as a heatmap; by default it represents the density of points, but it can be the result of an aggregation function.
         * - `aggregation`: data is aggregated based on their geo shape (e.g. two records with the exact same associated shape); by default the color represents
         * the number of aggregated records, but it can be the result of an aggregation function. This mode supports aggregating the context
         * using a join with another context that contains geometrical shapes: use a `joinContext` property, and `localKey` and `remoteKey` to configure
         * the field names of the local and joined datasets; you can also configure one of the fields from the "remote" dataset to be displayed when the mouse
         * hovers the shapes, using `hoverField` and the name of a field.
         *
         * Apart from `heatmap`, all display modes support color configuration. Three types of configurations are available, depending on the display mode.
         *
         * - `color`: a simple color, as an hex code (#FF0F05) or a simple CSS color name like "red". Available for any mode except `heatmap`.
         * - `colorScale`: the name of a ColorBrewer [http://colorbrewer2.org/] scheme, like "YlGnBu". Available for `shape`.
         * - `colorRanges`: a serie of colors and ranges separated by a semicolon, to decide a color depending on a value. For example "red;20;orange;40;#00CE00" to color anything between
         * 20 and 40 in orange, below 20 in red, and above 40 in a custom hex color. Combine with a field name in `colorByField` to configure which field will be
         * used to decide on the color. Available for `raw` and `shape`.
         *
         * If you are displaying data where multiple points or shapes are stacked, you can configure the order in which the items will be
         * displayed in the tooltip, using `tooltipSort` and the name of a field, prefixed by `-` to have a reversed sort.
         * Note: by default, numeric fields are sorted in decreasing order, date and datetime are sorted chronologically, and text fields are sorted
         * alphanumerically.
         *
         * <pre>
         *     <ods-map>
         *         <!-- Reverse sort on 'field' -->
         *         <ods-map-layer context="mycontext" tooltip-sort="-field"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         *
         * By default, tooltips show the values associated with a point or shape in a simple template. You can configure your own template by adding
         * HTML inside the `<ods-map-layer></ods-map-layer>` tag. Your template is AngularJS-enabled and will be provided with a `record` object; this object contains
         * a `fields` object with all the values associated with the clicked point or shape.
         *
         * <pre>
         *    <ods-map location="12,48.86167,2.34146">
         *        <ods-map-layer context="mycontext">
         *            <div>my value is: {{record.fields.myvalue}}</div>
         *        </ods-map-layer>
         *    </ods-map>
         * </pre>
         *
         * If your layer is displayed as `raw` or `shape`, you can configure a layer so that a click on an item triggers a refine on another context, using `refineOnClickContext`.
         * One or more contexts can be defined:
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" refine-on-click-context="mycontext2"></ods-map-layer>
         *         <ods-map-layer context="mycontext3" refine-on-click-context="[mycontext4, mycontext5]"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * By default, the filter occurs on geometry; for example, clicking on a shape filters the other context on the area.
         * You can also trigger a refine on specific fields; using `refineOnClickMapField` to configure the name of the field to get the value from, and `refineOnClickContextField`
         * to configure the name of the field of the other context to refine on. If you have two or more contexts, you can configure the fields by indicating the context in the
         * name of the property, as `refineOnClick[context]MapField` and `refineOnClick[context]ContextField`.
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" refine-on-click-context="[mycontext, mycontext2]"
         *                                            refine-on-click-mycontext-map-field="field1"
         *                                            refine-on-click-mycontext-context-field="field2"
         *                                            refine-on-click-mycontext2-map-field="field3"
         *                                            refine-on-click-mycontext2-context-field="field4"></ods-map-layer>
         *     </ods-map>
         * </pre>
         */
        return {
            restrict: 'EA',
            scope: {
                context: '=',
                mapContext: '=?', // An object holding location and basemap and updating it in realtime
                location: '@', // Hard-coded location (widget)
                basemap: '@', // Hard-coded basemap (widget),
                staticMap: '@', // Prevent the map to be moved,
                noRefit: '@',
                autoResize: '@',
                toolbarDrawing: '@',
                toolbarGeolocation: '@',
                toolbarFullscreen: '@'
            },
            transclude: true,
            template: '<div class="odswidget odswidget-map">' +
                        '<div class="map"></div>' +
                        '<div class="overlay map opaque-overlay" ng-show="pendingRequests.length && initialLoading"><spinner class="spinner"></spinner></div>' +
                        '<div class="loading-tiles" ng-show="loading"><i class="icon-spinner icon-spin"></i></div>' +
                        '<div ng-transclude></div>' + // Can't find any better solution...
                        '</div>',
            link: function(scope, element, attrs) {
                var mapElement = angular.element(element.children()[0]);
                // "Porting" the attributes to the real map.
                if (attrs.id) { mapElement.attr('id', attrs.id); }
                if (attrs.style) { mapElement.attr('style', attrs.style); }
                if (attrs['class']) { mapElement.addClass(attrs['class']); }

                var isStatic = scope.staticMap && scope.staticMap.toLowerCase() === 'true';
                var noRefit = scope.noRefit && scope.noRefit.toLowerCase() === 'true';
                var toolbarDrawing = !(scope.toolbarDrawing && scope.toolbarDrawing.toLowerCase() === 'false');
                var toolbarGeolocation = !(scope.toolbarGeolocation && scope.toolbarGeolocation.toLowerCase() === 'false');
                var toolbarFullscreen = !(scope.toolbarFullscreen && scope.toolbarFullscreen.toLowerCase() === 'false');

                if (attrs.context) {
                    // Handle the view defined on the map tag directly
                    var group = MapHelper.MapConfiguration.createLayerGroupConfiguration();
                    var layer = MapHelper.MapConfiguration.createLayerConfiguration();
                    group.activeDatasets.push(layer);
                    scope.mapConfig.layers.push(group);
                    var unwatch = scope.$watch('context', function(nv, ov) {
                        layer.context = nv;

                        // FIXME: Factorize the same code with odsLayerGroup
                        var unwatchSchema = scope.$watch('context.dataset', function(nv) {
                            if (nv) {
                                if (layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape') !== null) {
                                    layer.marker = !layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape');
                                } else {
                                    layer.marker = true;
                                }

                                layer.color = layer.context.dataset.getExtraMeta('visualization', 'map_marker_color') || "#C32D1C";
                                layer.picto = layer.context.dataset.getExtraMeta('visualization', 'map_marker_picto') || (layer.marker ? "circle" : "dot");


                                unwatchSchema();
                            }
                        });

                        unwatch();
                    });
                }

                function resizeMap() {
                    if (scope.autoResize === 'true' && $('.odswidget-map > .map').length > 0) {
                        // Only do this if visible
                        var height = Math.max(200, $(window).height() - $('.odswidget-map > .map').offset().top);
                        $('.odswidget-map > .map').height(height);
                    }
                }

                if (scope.autoResize === 'true') {
                    $(window).on('resize', resizeMap);
                    resizeMap();
                }

                /* INITIALISATION AND DEFAULT VALUES */
                scope.initialLoading = true;
                if (angular.isUndefined(scope.mapContext)) {
                    scope.mapContext = {};
                    if (scope.location) {
                        scope.mapContext.location = scope.location;
                    }
                    if (scope.basemap) {
                        scope.mapContext.basemap = scope.basemap;
                    }
                }

                /* END OF INITIALISATION */

                ModuleLazyLoader('leaflet').then(function() {
                    // Initializing the map
                    var mapOptions = {
                        basemapsList: ODSWidgetsConfig.basemaps,
                        worldCopyJump: true,
                        minZoom: 2,
                        basemap: scope.mapContext.basemap,
                        dragging: !isStatic,
                        zoomControl: !isStatic,
                        prependAttribution: ODSWidgetsConfig.mapPrependAttribution
                    };

                    if (isStatic) {
                        mapOptions.doubleClickZoom = false;
                        mapOptions.scrollWheelZoom = false;
                    }

                    resizeMap();

                    var map = new L.ODSMap(element.children()[0].children[0], mapOptions);

//                    map.setView(new L.LatLng(48.8567, 2.3508),13);
                    map.addControl(new L.Control.Scale());

                    if (toolbarFullscreen) {
                        // Only add the Fullscreen control if we are not in an iframe, as it is blocked by browsers
                        try {
                            if (window.self === window.top) {
                                // We are NOT in an iframe
                                map.addControl(new L.Control.Fullscreen());
                            }
                        } catch (e) {
                            // We are in an iframe
                        }
                    }


                    if (ODSWidgetsConfig.mapGeobox && !isStatic) {
                        var geocoder = L.Control.geocoder({
                            placeholder: translate('Find a place...'),
                            errorMessage: translate('Nothing found.'),
                            geocoder: new L.Control.Geocoder.Nominatim({serviceUrl: "https://nominatim.openstreetmap.org/", geocodingQueryParams: {"accept-language": ODSWidgetsConfig.language || 'en', "polygon_geojson": true}})
                        });
                        geocoder.markGeocode = function(result) {
                            map.fitBounds(result.bbox);

                            if (result.properties.geojson) {
                                var highlight = L.geoJson(result.properties.geojson, {
                                    style: function () {
                                        return {
                                            opacity: 0,
                                            fillOpacity: 0.8,
                                            fillColor: 'orange',
                                            className: 'leaflet-geocoder-highlight'
                                        };
                                    }
                                });
                                map.addLayer(highlight);
                                $timeout(function () {
                                    element.addClass('geocoder-highlight-on');
                                }, 0);
                                $timeout(function () {
                                    element.removeClass('geocoder-highlight-on');
                                    map.removeLayer(highlight);
                                }, 2500);
                            }
                        };
                        map.addControl(geocoder);
                    }

                    if (toolbarGeolocation && !isStatic) {
                        map.addControl(new L.Control.Locate({maxZoom: 18}));
                    }

                    // Drawing
                    scope.drawnItems = new L.FeatureGroup(); // Necessary to show geofilters
                    map.addLayer(scope.drawnItems);

                    if (toolbarDrawing && !isStatic) {
                        // Localize all the messages
                        L.drawLocal.draw.toolbar.buttons.circle = translate('Draw a circle to filter on');
                        L.drawLocal.draw.toolbar.buttons.polygon = translate('Draw a polygon to filter on');
                        L.drawLocal.draw.toolbar.buttons.rectangle = translate('Draw a rectangle to filter on');
                        L.drawLocal.draw.toolbar.actions = {
                            title: translate('Cancel area filter'),
                            text: translate('Cancel')
                        };
                        L.drawLocal.draw.toolbar.undo = {
                            title: translate('Delete last point'),
                            text: translate('Delete last point')
                        };
                        L.drawLocal.edit.toolbar.buttons = {
                            edit: translate('Edit area filter.'),
                            editDisabled: translate('No area filter to edit.'),
                            remove: translate('Delete area filter.'),
                            removeDisabled: translate('No area filter to delete.')
                        };
                        L.drawLocal.edit.toolbar.actions = {
                            save: {
                                title: translate('Save changes.'),
                                text: translate('Save')
                            },
                            cancel: {
                                title: translate('Cancel editing, discards all changes.'),
                                text: translate('Cancel')
                            }
                        };

                        var drawControl = new L.Control.Draw({
                            edit: {
                                featureGroup: scope.drawnItems
                            },
                            draw: {
                                polyline: false,
                                marker: false
                            }
                        });
                        map.addControl(drawControl);
                    }

                    scope.map = map;

                    // Now that the map is ready, we need to know where to set the map first
                    // - If there is an explicit location, use it. This includes older legacy parameters and formats
                    // - Else, we deduce it from the displayed datasets
                    var setInitialMapView = function(location) {
                        var deferred = $q.defer();

                        if (location) {
                            var loc = MapHelper.getLocationStructure(location);
                            scope.map.setView(loc.center, loc.zoom);
                            waitForVisibleContexts().then(function() {
                                refreshData(false);
                            });

                            deferred.resolve();
                        } else {
                            waitForVisibleContexts().then(function() {
                                MapHelper.retrieveBounds(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, true)).then(function (bounds) {
                                    // Fit to dataset boundingbox if there is no viewport or geofilter
                                    if (bounds) {
                                        scope.map.fitBounds(bounds);
                                    } else {
                                        var loc = MapHelper.getLocationStructure(ODSWidgetsConfig.defaultMapLocation);
                                        scope.map.setView(loc.center, loc.zoom);
                                    }
                                    refreshData(false);

                                    deferred.resolve();
                                });
                            });
                        }

                        return deferred.promise;
                    };

                    setInitialMapView(scope.mapContext.location).then(function() {
                        scope.initialLoading = false;
                        onViewportMove(scope.map);

                        scope.map.on('moveend', function(e) {
                            // Whenever the map moves, we update the displayed data
                            scope.$apply(function() {
                                onViewportMove(e.target);
                            });
                        });

                        // Refresh events
                        scope.$watch('mapContext.location', function(nv, ov) {
                            if (nv !== ov) {
                                // When the location changes, triggers a data refresh.
                                // We could do it in the moveend event instead of watching the location, but that way we ensure that
                                // if something else from outside changes the location, we react as well.
                                refreshData(false, true);
                            }
                        });

                        if (!isStatic) {
                            // Initialize all the drawing support events
                            initDrawingTools();
                        }

                        // INitialize watcher
                        scope.$watch(function() {
                            var pending = 0;
                            angular.forEach(scope.mapConfig.layers, function(groupConfig) {
                                angular.forEach(groupConfig.activeDatasets, function(layerConfig) {
                                    if (layerConfig.loading) {
                                        pending++;
                                    }
                                });
                            });
                            return pending;
                        }, function(nv) {
                            if (nv) {
                                scope.loading = true;
                            } else {
                                scope.loading = false;
                            }
                        });

                        // Initialize data watchers
                        // TODO: Make the contexts broadcast an event when the parameters change? Will spare
                        // a potentially heavy watch.
                        scope.$watch(function() {
                            var params = [];
                            angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig), function(ctx) {
                                params.push(ctx.parameters);
                            });
                            return params;
                        }, function(nv, ov) {
                            if (nv !== ov) {
                                // Refresh with a refit
                                syncGeofilterToDrawing();
                                refreshData(true);
                            }
                        }, true);
                    });

                    if (ODSWidgetsConfig.basemaps.length > 1) {
                        scope.map.on('baselayerchange', function (e) {
                            scope.$evalAsync('mapContext.basemap = "'+e.layer.basemapId+'"');


                            // The bundle layer zooms have to be the same as the basemap, else it will drive the map
                            // to be zoomable beyond the basemap levels
                            angular.forEach(scope.mapConfig.layers, function(groupConfig) {
                                if (groupConfig.displayed) {
                                    angular.forEach(groupConfig.activeDatasets, function (layerConfig) {
                                        if (layerConfig.clusterMode === 'tiles' && layerConfig.rendered) {
                                            layerConfig.rendered.setMinZoom(e.layer.options.minZoom);
                                            layerConfig.rendered.setMaxZoom(e.layer.options.maxZoom);
                                        }
                                    });
                                }
                            });
                        });
                    }

                    var onViewportMove = function(map) {
                        var size = map.getSize();
                        if (size.x > 0 && size.y > 0) {
                            // Don't attempt to do anything if the map is not displayed... we can't capture useful bounds
                            scope.mapContext.location = MapHelper.getLocationParameter(map.getCenter(), map.getZoom());
                        }
                    };

                    var refreshData = function(fitView, locationChangedOnly) {
                        /* Used when one of the context changes, or the viewport changes: triggers a refresh of the displayed data
                           If "fitView" is true, then the map moves to the new bounding box containing all the data, before
                           beginning to render the result.

                           dataUnchanged means only the location changed, and some layers don't need a refresh at all (tiles, or
                           layers that load all at once)
                         */
                        fitView = !noRefit && fitView;
                        var renderData = function(locationChangedOnly) {
                            var promises = [];
                            angular.forEach(scope.mapConfig.layers, function(layerGroup) {
                                if (!layerGroup.displayed) {
                                    angular.forEach(layerGroup.activeDatasets, function(layer) {
                                        if (layer.rendered) {
                                            scope.map.removeLayer(layer.rendered);
                                            layer.rendered = null;
                                        }
                                    });
                                    return;
                                }
                                angular.forEach(layerGroup.activeDatasets, function(layer) {
                                    // Depending on the layer config, we can opt for various representations

                                    // Tiles: call a method on the existing layer
                                    // Client-side: build a new layer and remove the old one
                                    if (!locationChangedOnly || MapLayerRenderer.doesLayerRefreshOnLocationChange(layer)) {
                                        promises.push(MapLayerRenderer.updateDataLayer(layer, scope.map));
                                    }
                                });
                            });
                            $q.all(promises).then(function() {
                                // We got them all
                                // FIXME: Do we have something to do here?
                            });
                        };

                        if (fitView) {
                            // Move the viewport to the new location, and change the tile
                            MapHelper.retrieveBounds(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, true)).then(function(bounds) {
                                if (bounds && bounds !== MapHelper.WORLD_BOUNDS) {
                                    // Until $applyAsync... Make sure the fitting is done outside this digest cycle,
                                    // so that the triggering of viewport move doesn't clash with it
                                    $timeout(function() {
                                        var before = scope.map.getBounds().toBBoxString();
                                        scope.map.fitBounds(bounds);
                                        var after = scope.map.getBounds().toBBoxString();

                                        if (before === after) {
                                            // The map didn't move, so we can't rely on the location change to trigger a refresh
                                            refreshData(false, true);
                                        }
                                    }, 0);
                                } else {
                                    renderData(locationChangedOnly);
                                }
                            });
                        } else {
                            renderData();
                        }
                    };

                    var initDrawingTools = function() {
                        // Make sure we know when the user is drawing, so that we can ignore other interactions (click on
                        // shapes...)
                        scope.map.on('draw:drawstart draw:editstart', function() {
                            scope.map.isDrawing = true;
                        });
                        scope.map.on('draw:drawstop draw:editstop', function() {
                            scope.map.isDrawing = false;
                        });

                        // Set the drawn items as clickable when in deletion mode. We have to do it manually because
                        // we are redrawing our own shapes (due to parameter sync on init) instead of using the leaflet-draw builtint.
                        var setLayerInteractive = function(layer) {
                            layer._path.setAttribute('style','cursor: pointer; pointer-events: auto;');
                        };
                        var setLayerNonInteractive = function(layer) {
                            layer._path.setAttribute('style','cursor: auto; pointer-events: none;');
                        };

                        scope.map.on('draw:deletestart', function() {
                            setLayerInteractive(scope.drawnItems.getLayers()[0]);
                        });

                        scope.map.on('draw:deleteend', function() {
                            setLayerNonInteractive(scope.drawnItems.getLayers()[0]);
                        });

                        // Applying drawing effects on contexts
                        scope.map.on('draw:created', function (e) {
                            var layer = e.layer;
                            if (scope.drawnItems.getLayers().length > 0) {
                                scope.drawnItems.removeLayer(scope.drawnItems.getLayers()[0]);
                            }
                            scope.drawnItems.addLayer(layer);

                            // Apply to parameters
                            applyDrawnLayer(layer, e.layerType);

                            scope.$apply();
                        });

                        scope.map.on('draw:edited', function(e) {
                            var layer = e.layers.getLayers()[0];
                            var type = getDrawnLayerType(layer);

                            applyDrawnLayer(layer, type);
                            scope.$apply();
                        });

                        scope.map.on('draw:deleted', function(e) {
                            delete scope.mapConfig.drawnArea;
                            scope.$apply();
                        });

                        var applyDrawnLayer = function(layer, type) {
                            if (type === 'circle') {
                                var distance = layer.getRadius();
                                var center = layer.getLatLng();
                                scope.mapConfig.drawnArea = {
                                    'shape': 'circle',
                                    'coordinates': center.lat + ',' + center.lng + ',' + distance
                                };
                            } else {
                                // Compute the polygon
                                var geoJson = layer.toGeoJSON();
                                var path = ODS.GeoFilter.getGeoJSONPolygonAsPolygonParameter(geoJson.geometry);
                                scope.mapConfig.drawnArea = {
                                    'shape': 'polygon',
                                    'coordinates': path
                                };
                            }
                        };

                        var getDrawnLayerType = function(layer) {
                            if (angular.isDefined(layer.getRadius)) {
                                return 'circle';
                            } else {
                                return 'polygon';
                            }
                        };

                        var drawableStyle = {
                            color: '#2ca25f',
                            fillOpacity: 0.2,
                            opacity: 0.8,
                            clickable: true
                        };

                        scope.$watch('mapConfig.drawnArea', function(nv, ov) {
                            // Wipe the current drawn polygon
                            if (scope.drawnItems.getLayers().length > 0) {
                                scope.drawnItems.removeLayer(scope.drawnItems.getLayers()[0]);
                            }

                            // Draw
                            var drawn;
                            if (nv) {
                                if (nv.shape === 'polygon') {
                                    // FIXME: maybe a cleaner way than using GeoJSON, but it felt weird adding a method
                                    // just to output a Leaflet-compatible arbitrary format. Still, we should do it.
                                    var geojson = ODS.GeoFilter.getPolygonParameterAsGeoJSON(nv.coordinates);
                                    var coordinates = geojson.coordinates[0];
                                    coordinates.splice(geojson.coordinates[0].length - 1, 1);
                                    var i, coords, swap;
                                    for (i = 0; i < coordinates.length; i++) {
                                        coords = coordinates[i];
                                        swap = coords[0];
                                        coords[0] = coords[1];
                                        coords[1] = swap;
                                    }
                                    if (coordinates.length === 4 &&
                                        coordinates[0][0] === coordinates[3][0] &&
                                        coordinates[1][0] === coordinates[2][0] &&
                                        coordinates[0][1] === coordinates[1][1] &&
                                        coordinates[2][1] === coordinates[3][1]) {
                                        drawn = new L.Rectangle(coordinates, drawableStyle);
                                    } else {
                                        drawn = new L.Polygon(coordinates, drawableStyle);
                                    }
                                    //drawn = new L.GeoJSON(geojson);
                                } else if (nv.shape === 'circle') {
                                    var parts = nv.coordinates.split(',');
                                    var lat = parts[0],
                                        lng = parts[1],
                                        radius = parts[2];
                                    drawn = new L.Circle([lat, lng], radius, drawableStyle);
                                }

                                if (drawn) {
                                    scope.drawnItems.addLayer(drawn);
                                    setLayerNonInteractive(scope.drawnItems.getLayers()[0]);
                                }
                            }

                            // Apply to every context available
                            angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, true), function(ctx) {
                                if (nv) {
                                    // There is something to apply
                                    if (nv.shape === 'circle') {
                                        ctx.parameters['geofilter.distance'] = nv.coordinates;
                                        delete ctx.parameters['geofilter.polygon'];
                                    } else if (nv.shape === 'polygon') {
                                        ctx.parameters['geofilter.polygon'] = nv.coordinates;
                                        delete ctx.parameters['geofilter.distance'];
                                    }
                                } else {
                                    // Remove the filters
                                    delete ctx.parameters['geofilter.polygon'];
                                    delete ctx.parameters['geofilter.distance'];
                                }
                            });

                        }, true);
                    };
                });

                var waitForVisibleContexts = function() {
                    var deferred = $q.defer();

                    // Watches all the active contexts, and resolves once they are ready
                    // FIXME: Include joinContexts and refineOnClickContexts
                    var contexts = MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig);

                    var promises = contexts.map(function(context) { return context.wait(); });
                    $q.all(promises).then(function() {
                        syncGeofilterToDrawing();
                        deferred.resolve();
                    });

                    return deferred.promise;
                };

                var syncGeofilterToDrawing = function() {
                    // Check if there are geofilters shared by everyone at init time, and if so, synchronize the
                    // drawn shapes to match them.
                    var polygon, distance;
                    angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, true), function(context) {
                        if (angular.isUndefined(polygon) && angular.isUndefined(polygon)) {
                            // First time
                            polygon = context.parameters['geofilter.polygon'];
                            distance = context.parameters['geofilter.distance'];
                        } else {
                            if (polygon !== context.parameters['geofilter.polygon']) {
                                polygon = null;
                            }
                            if (distance !== context.parameters['geofilter.distance']) {
                                distance = null;
                            }
                        }
                    });
                    if (polygon) {
                        scope.mapConfig.drawnArea = {
                            shape: 'polygon',
                            coordinates: polygon
                        };
                    } else if (distance) {
                        scope.mapConfig.drawnArea = {
                            shape: 'circle',
                            coordinates: distance
                        };
                    } else {
                        scope.mapConfig.drawnArea = {};
                    }
                };

                // TODO: Plug polygon drawing to the geofilter.polygon of every context. Possibly store it in a specific
                // place in the map config, so we know which one to use when loading the map

            },
            controller: ['$scope', function($scope) {
                $scope.mapConfig = {
                    'layers': []
                };
                //
                this.registerLayer = function(layer) {
                    // Register with a dummy single-layer-group
                    var group = MapHelper.MapConfiguration.createLayerGroupConfiguration();
                    group.activeDatasets.push(layer);
                    $scope.mapConfig.layers.push(group);
                    return group;
                };

                this.registerLayerGroup = function(layer) {
                    $scope.mapConfig.layers.push(layer);
                };
            }]
        };
    }]);

    mod.directive('odsMapLayerGroup', function() {
        // TODO: Plug for real
        return {
            restrict: 'EA',
            scope: {},
            require: '^odsMap',
            link: function(scope, element, attrs, mapCtrl) {
                mapCtrl.registerLayerGroup(scope.group);
            },
            controller: ['$scope', function($scope) {
                $scope.group = {'activeDatasets': []};

                this.registerLayer = function(obj) {
                    // Register to the group
                    $scope.group.activeDatasets.push(obj);
                    return $scope.group;
                };
            }]
        };
    });

    mod.directive('odsMapLayer', ['MapHelper', function(MapHelper) {
        return {
            restrict: 'EA',
            scope: {
                context: '=',
                showIf: '=',
                color: '@',
                colorScale: '@',
                colorRanges: '@',
                colorByField: '@',
                picto: '@',
                showMarker: '@',
                display: '@',
                'function': '@', // A less risky name?
                expression: '@',

                tooltipSort: '@',
                hoverField: '@',

                refineOnClickContext: '=',

                joinContext: '=',
                localKey: '@',
                remoteKey: '@'
            },
            template: function(tElement) {
                var tpl = '';
                tElement.contents().wrapAll('<div>');
                if (tElement.contents().length > 0 && tElement.contents().html().trim().length > 0) {
                    tElement.contents().wrapAll('<div>');
                    tpl = tElement.children().html();
                }
                // Yes, it seems highly weird, but unfortunately it sems to be the only option as we want to get the
                // original content BEFORE compile, and pass it to the link function.
                return '<div tooltiptemplate="'+tpl.replace(/"/g, '&quot;')+'"></div>';
            },
            require: ['?^odsMapLayerGroup', '^odsMap'],
            link: function(scope, element, attrs, controllers) {
                var layerGroupCtrl  = controllers[0],
                    mapCtrl         = controllers[1];
                var tplHolder = angular.element(element.children()[0]);
                var customTemplate = tplHolder.attr('tooltiptemplate');

                var color;
                if (scope.color) {
                    color = scope.color;
                } else if (scope.colorScale) {
                    color = {
                        type: 'scale',
                        scale: scope.colorScale
                    };
                } else if (scope.colorRanges) {
                    var tokens = scope.colorRanges.split(';');
                    var ranges = tokens.filter(function(elt, idx) { return idx % 2 === 1; });
                    var colors = tokens.filter(function(elt, idx) { return idx % 2 === 0; });
                    color = {
                        type: 'range',
                        ranges: ranges,
                        colors: colors,
                        field: scope.colorByField
                    };
                }

                var layer = MapHelper.MapConfiguration.createLayerConfiguration(customTemplate, color, scope.picto, scope.display, scope['function'], scope.expression, scope.localKey, scope.remoteKey, scope.tooltipSort, scope.hoverField);
                var layerGroup;
                if (layerGroupCtrl) {
                    // Register to the group
                    layerGroup = layerGroupCtrl.registerLayer(layer);
                } else {
                    // Register to the map
                    layerGroup = mapCtrl.registerLayer(layer);
                }

                if (attrs.showIf) {
                    scope.$watch('showIf', function(nv, ov) {
                        layerGroup.displayed = nv;
                    });
                }

                var unwatch = scope.$watch('context', function(nv, ov) {
                    layer.context = nv;

                    var unwatchSchema = scope.$watch('context.dataset', function(nv) {
                        if (nv) {
                            if (scope.showMarker) {
                                layer.marker = (scope.showMarker.toLowerCase() === 'true');
                            } else if (layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape') !== null) {
                                layer.marker = !layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape');
                            } else {
                                layer.marker = true;
                            }

                            layer.color = layer.color || layer.context.dataset.getExtraMeta('visualization', 'map_marker_color') || "#C32D1C";
                            layer.picto = layer.picto || layer.context.dataset.getExtraMeta('visualization', 'map_marker_picto') || (layer.marker ? "circle" : "dot");


                            unwatchSchema();
                        }
                    });

                    unwatch();
                });

                var unwatchJoinContext = scope.$watch('joinContext', function(nv) {
                    if (nv) {
                        layer.joinContext = nv;
                        unwatchJoinContext();
                    }
                });

                var unwatchRefineOnClick = scope.$watch('refineOnClickContext', function(nv) {
                    if (angular.isArray(nv)) {
                        // Check that all contexts are defined
                        var allDefined = true;
                        angular.forEach(nv, function(ctx) {
                            allDefined = allDefined && angular.isDefined(ctx);
                        });
                        if (!allDefined) {
                            return;
                        }

                    } else if (!nv) {
                        return;
                    }

                    layer.refineOnClick = [];
                    var contexts = angular.isArray(nv) && nv || [nv];
                    angular.forEach(contexts, function(ctx) {
                        layer.refineOnClick.push({
                            context: ctx,
                            mapField: attrs['refineOnClick' + ODS.StringUtils.capitalize(ctx.name) + 'MapField'] || attrs.refineOnClickMapField,
                            contextField: attrs['refineOnClick' + ODS.StringUtils.capitalize(ctx.name) + 'ContextField'] || attrs.refineOnClickContextField
                        });
                        unwatchRefineOnClick();
                    });
                });
            },
            controller: ['$scope', function($scope) {
            }]
        };
    }]);

    mod.directive('geoScroller', ['$compile', '$templateCache', function($compile, $templateCache) {
        // FIXME: remove the ugly div from the DL tag, once we migrate to Angular 1.2+
        return {
            restrict: 'E',
            transclude: true,
            template: '<div class="odswidget-geo-scroller">' +
                    '<spinner ng-hide="records"></spinner>' +
                    '<h2 ng-show="records.length > 1" class="scroller-control ng-leaflet-tooltip-cloak">' +
                        '<i class="icon-chevron-left" ng-click="moveIndex(-1)"></i>' +
                        '<span ng-bind="(selectedIndex+1)+\'/\'+records.length" ng-click="moveIndex(1)"></span>' +
                        '<i class="icon-chevron-right" ng-click="moveIndex(1)"></i>' +
                    '</h2>' +
                    '<div class="ng-leaflet-tooltip-cloak limited-results" ng-show="records && records.length == RECORD_LIMIT" translate>(limited to the first {{RECORD_LIMIT}} records)</div>' +
                    '<div ng-repeat="record in records" ng-show="$index == selectedIndex" class="map-tooltip">' +
                        '<div ng-if="!template" ng-include src="\'default-tooltip\'"></div>' +
                        '<div ng-if="template" ng-include src="\'custom-tooltip-\'+context.dataset.datasetid"></div>' +
                    '</div>' +
                '</div>',
            scope: {
                shape: '=',
                context: '=',
                recordid: '=',
                map: '=',
                template: '@',
                gridData: '=',
                geoDigest: '@',
                tooltipSort: '@' // field or -field
            },
            replace: true,
            link: function(scope, element, attrs) {
                var destroyPopup = function(e) {
                    if (e.popup._content === element[0]) {
                        if (scope.selectedShapeLayer) {
                            // Remove the outline on the selected shape
                            scope.map.removeLayer(scope.selectedShapeLayer);
                        }
                        scope.map.off('popupclose', destroyPopup);
                        scope.$destroy();
                    }
                };
                scope.map.on('popupclose', destroyPopup);
                scope.unCloak = function() {
                    jQuery('.ng-leaflet-tooltip-cloak', element).removeClass('ng-leaflet-tooltip-cloak');
                };
                if (attrs.template && attrs.template !== '') {
                    $templateCache.put('custom-tooltip-' + scope.context.dataset.datasetid, attrs.template);
                } else {
                    $templateCache.put('default-tooltip', '<div class="infoPaneLayout">' +
                        '<h2 ng-show="!!getTitle(record)" ng-bind="getTitle(record)"></h2>' +
                        '<dl>' +
                        '    <dt ng-repeat-start="field in context.dataset.fields|fieldsForVisualization:\'map\'|fieldsFilter:context.dataset.extra_metas.visualization.map_tooltip_fields" ng-show="record.fields[field.name]|isDefined">' +
                        '        {{ field.label }}' +
                        '    </dt>' +
                        '    <dd ng-repeat-end ng-switch="field.type" ng-show="record.fields[field.name]|isDefined">' +
                        '        <debug data="record.fields[field.name]"></debug>' +
                        '        <span ng-switch-when="geo_point_2d">' +
                        '            <ods-geotooltip width="300" height="300" coords="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</ods-geotooltip>' +
                        '        </span>' +
                        '        <span ng-switch-when="geo_shape">' +
                        '            <ods-geotooltip width="300" height="300" geojson="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</ods-geotooltip>' +
                        '        </span>' +
                        '        <span ng-switch-when="file">' +
                        '            <div ng-bind-html="record.fields[field.name]|displayImageValue:context.dataset.datasetid" style="text-align: center;"></div>' +
                        '        </span>' +
                        '        <span ng-switch-default title="{{record.fields|formatFieldValue:field}}" ng-bind-html="record.fields|formatFieldValue:field|imagify|youtubify|prettyText|nofollow"></span>' +
                        '    </dd>' +
                        '</dl>' +
                    '</div>');
                }

            },
            controller: ['$scope', '$filter', 'ODSAPI', 'ODSWidgetsConfig', '$sce', function($scope, $filter, ODSAPI, ODSWidgetsConfig, $sce) {
                $scope.RECORD_LIMIT = 100;
                $scope.records = [];
                $scope.selectedIndex = 0;


                var tooltipSort = $scope.tooltipSort;
                if (!tooltipSort && $scope.context.dataset.getExtraMeta('visualization', 'map_tooltip_sort_field')) {
                    tooltipSort = ($scope.context.dataset.getExtraMeta('visualization', 'map_tooltip_sort_direction') || '') + $scope.context.dataset.getExtraMeta('visualization', 'map_tooltip_sort_field');
                }

                $scope.moveIndex = function(amount) {
                    var newIndex = ($scope.selectedIndex + amount) % $scope.records.length;
                    if (newIndex < 0) {
                        newIndex = $scope.records.length + newIndex;
                    }
                    $scope.selectedIndex = newIndex;
                };

                var refresh = function() {
                    var options = {
                        format: 'json',
                        rows: $scope.RECORD_LIMIT
                    };
                    var shapeType = null;
                    if ($scope.shape) {
                        shapeType = $scope.shape.type;
                    }
                    if ($scope.recordid && shapeType !== 'Point') {
                        // When we click on a point, we rather want to match the location so that it fetches the other points
                        // stacked on the same place
                        options.q = "recordid:'"+$scope.recordid+"'";
                    } else if ($scope.geoDigest) {
                        options.geo_digest = $scope.geoDigest;
                    } else if ($scope.gridData) {
                        // From an UTFGrid tile
                        if ($scope.gridData['ods:geo_type'] === 'GeoPointCluster' || $scope.gridData['ods:geo_type'] === 'GeoShapeCluster') {
                            // Request geo_grid
                            options.geo_grid = $scope.gridData['ods:geo_grid'];
                        } else {
                            // Request geo_hash
                            options.geo_digest = $scope.gridData['ods:geo_digest'];
                        }
                    } else if ($scope.shape) {
                        ODS.GeoFilter.addGeoFilterFromSpatialObject(options, $scope.shape);
                    }

                    var queryOptions = {};
                    angular.extend(queryOptions, $scope.context.parameters, options);

                    if (tooltipSort) {
                        queryOptions.sort = tooltipSort;
                        ODSAPI.records.search($scope.context, queryOptions).success(function(data) { handleResults(data.records); });
                    } else {
                        ODSAPI.records.download($scope.context, queryOptions).success(handleResults);
                    }

                    function handleResults(data) {
                        if (data.length > 0) {
                            $scope.selectedIndex = 0;
                            $scope.records = data;
                            $scope.unCloak();
                            var shapeFields = $scope.context.dataset.getFieldsForType('geo_shape');
                            var shapeField;
                            if (shapeFields.length) {
                                shapeField = shapeFields[0].name;
                            }
                            if (shapeField && $scope.gridData &&
                                ($scope.gridData['ods:geo_type'] === 'Polygon' ||
                                 $scope.gridData['ods:geo_type'] === 'LineString' ||
                                 $scope.gridData['ods:geo_type'] === 'MultiPolygon' ||
                                 $scope.gridData['ods:geo_type'] === 'MultiLineString'
                                )) {
                                // Highlight the selected polygon
                                var record = data[0];
                                if (record.fields[shapeField]) {
                                    var geojson = record.fields[shapeField];
                                    if (geojson.type !== 'Point') {
                                        $scope.selectedShapeLayer = L.geoJson(geojson, {
                                            fill: false,
                                            color: '#CC0000',
                                            opacity: 1,
                                            dashArray: [5],
                                            weight: 2

                                        });
                                        $scope.map.addLayer($scope.selectedShapeLayer);
                                    }
                                }
                            }
                        } else {
                            $scope.map.closePopup();
                        }
                    }
                };

                $scope.$watch('searchOptions', function(nv, ov) {
                    refresh();
                });
                $scope.$apply();

                /* *** HELPER METHODS FOR THE TEMPLATES *** */
                $scope.getTitle = function(record) {
                    if ($scope.context.dataset.extra_metas && $scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.map_tooltip_title) {
                        var titleField = $scope.context.dataset.extra_metas.visualization.map_tooltip_title;
                        if (angular.isDefined(record.fields[titleField]) && record.fields[titleField] !== '') {
                            return record.fields[titleField];
                        }
                    }
                    return null;
                };
            }]
        };
    }]);

}());