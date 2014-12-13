"use strict";

(function () {
   
	var OGCHelper = {};
 
    OGCHelper.WCSParser = {};
    /**
     * static array where CRS availables for OGCHelper are defined
     */
    OGCHelper.CRS = [{
        name: "CRS:84",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: false,
        tilingScheme: Cesium.GeographicTilingScheme,
        supportedCRS: "urn:ogc:def:crs:OGC:2:84"
    }, {
        name: "EPSG:4326",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: true,
        tilingScheme: Cesium.GeographicTilingScheme,
        SupportedCRS: "urn:ogc:def:crs:EPSG::4326"
    }, {
        name: "EPSG:3857",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: false,
        tilingScheme: Cesium.WebMercatorTilingScheme,
        SupportedCRS: "urn:ogc:def:crs:EPSG::3857"
    }, {
        name: "OSGEO:41001",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: false,
        tilingScheme: Cesium.WebMercatorTilingScheme,
        SupportedCRS: "urn:ogc:def:crs:EPSG::3857"
    }];

    
    OGCHelper.WCSParser.generate = function (description) {
        var resultat;
        description = Cesium.defaultValue(description,
            Cesium.defaultValue.EMPTY_OBJECT);
        if (Cesium.defined(description.url)) {
            var urlofServer = description.url;
            var index = urlofServer.lastIndexOf("?");
            if (index > -1) {
                urlofServer = urlofServer.substring(0, index);
            }
            // get version of wcs
            if (!Cesium.defined(description.layerName)) {
                throw new Cesium.DeveloperError(
                    'description.layerName is required.');
            }
          

            var urlDescribeCoverage = urlofServer
                + '?SERVICE=WCS&VERSION=2.0.1&REQUEST=DescribeCoverage&CoverageId=' + description.layerName ;


            if (Cesium.defined(description.proxy)) {
                urlDescribeCoverage = description.proxy.getURL(urlDescribeCoverage);
            }

            resultat = Cesium.when(Cesium.loadWithXhr({url: urlDescribeCoverage, responseType: ''}),
                function (data) {
                    return OGCHelper.WCSParser.getDescribeCoverage(data, description);
                });


        } else if (Cesium.defined(description.xml)) {
            resultat = OGCHelper.WCSParser.getDescribeCoverage(description.xml, description);
        } else {
            throw new Cesium.DeveloperError(
                'either description.url or description.xml are required.');
        }
        return resultat;
    };


    function convertToFloat(tab) {
        for (var j = 0; j < tab.length; j++) {
            var b = parseFloat(tab[j]);
            if (!isNaN(b))
                tab[j] = b;
        }
        return tab;
    }

    function invertTab(tab) {
        var b= tab[1];
        tab[1]=tab[0];
        tab[0]=b;
        return tab;
    }

  
    OGCHelper.WCSParser.getDescribeCoverage = function (coverage, description) {

        var resultat = {};

        if (!Cesium.defined(description.layerName)) {
            throw new Cesium.DeveloperError(
                'description.layerName is required.');
        }

        var layerName = description.layerName;
        var maxLevel = Cesium.defaultValue(description.maxLevel, 11);

        resultat.heightMapWidth = Cesium.defaultValue(description.heightMapWidth, 65);
        resultat.heightMapHeight = Cesium.defaultValue(description.heightMapHeight, resultat.heightMapWidth);

        // Check CoverageId == LayerName
        var CoverageId = $('wcs\\:Coverageid, Coverageid', $(coverage)).text();
        var lowerCorner =convertToFloat( $('gml\\:lowerCorner, lowerCorner', $(coverage)).text().split(' '));
        var upperCorner = convertToFloat($('gml\\:upperCorner, upperCorner', $(coverage)).text().split(' '));

        // Missing Get Axis Label to know if Lat Long or Long Lat 
        var invertAxis = true;
        if (invertAxis)
        {
            upperCorner = invertTab(upperCorner);
            lowerCorner = invertTab(lowerCorner);
        }

        var low = convertToFloat( $('gml\\:low, low', $(coverage)).text().split(' '));
        var high = convertToFloat( $('gml\\:high, high', $(coverage)).text().split(' '));


        // Missing GetCRS ( CRS is CRS of Enveloppe or CRS of IMage 
        var enveloppe = $('gml\\:Enveloppe, Enveloppe', $(coverage));

        var pCRS = 4326;
        var projstring = 'EPSG:' + pCRS.toString();
        var getCRS = OGCHelper.CRS.filter(function (elt) {
            return elt.name === projstring;
        });
        if (getCRS.length > 0)
            resultat.tilingScheme = new getCRS[0].tilingScheme({
                ellipsoid: getCRS[0].ellipsoid
            });
        else
            resultat.tilingScheme = undefined;
        
        resultat.pixelSize = [(upperCorner[0] - lowerCorner[0]) / (high[0] - low[0]),(upperCorner[1] - lowerCorner[1]) / (high[1] - low[1])];

        resultat.levelZeroMaximumGeometricError = Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(resultat.tilingScheme._ellipsoid, 
																														 Math.min(resultat.heightMapWidth, resultat.heightMapHeight), 
																														 resultat.tilingScheme.getNumberOfXTilesAtLevel(0));

        resultat.waterMask = false;

        resultat.ready = true;


        var bbox = {
            'WKID': 4326,
            'EPSG': projstring,
             'coord': [[lowerCorner[0], upperCorner[1]], [lowerCorner[0], lowerCorner[1]], [upperCorner[0], lowerCorner[1]], [upperCorner[0], upperCorner[1]]],
            'ulidx': 0,
            'llidx': 1,
            'lridx': 2,
            'uridx': 3
        };
        resultat.bbox = bbox;

        resultat.getTileDataAvailable = function (x, y, level) {
            if (level < 18)
                return true;
            return false;

        };

        
        // Define the URL for GetCoverage
        var urlofServer = description.url;
        var index = urlofServer.lastIndexOf("?");
        if (index > -1) {
            urlofServer = urlofServer.substring(0, index);
        }
       


        var mntBbox = "&SUBSET=Long,EPSG:4326({west},{east})&SUBSET=Lat,EPSG:4326({south},{north})";
        var scaling = "&ScaleAxesByFactor=Lat({scaleX}),Long({scaleY})";
        var urlGetCoverage = urlofServer
            + '?SERVICE=WCS&VERSION=2.0.1&FORMAT=image/geotiff&REQUEST=GetCoverage&CoverageId=' + description.layerName + mntBbox + scaling;


        if (Cesium.defined(description.proxy)) {
            urlGetCoverage = description.proxy.getURL(urlGetCoverage);
        }
        resultat.urlGetCoverage = urlGetCoverage;


        // Is the X,Y,Level define a tile that contans or overlaps our bbox
        resultat.isInTile = function (x, y, level, provider) {
            var inside = true;
            var bbox = resultat.bbox;
            var rect = provider.tilingScheme.tileXYToNativeRectangle(x, y, level);

            if (bbox.coord[bbox.ulidx][0] >= rect.east || bbox.coord[bbox.lridx][0] <= rect.west ||
              bbox.coord[bbox.lridx][1] >= rect.north || bbox.coord[bbox.ulidx][1] <= rect.south) {
                inside = false;
            }
            return inside;

        };

        return resultat;
    };

 

    /**
     * A {@link TerrainProvider} that produces geometry by tessellating height
     * maps retrieved from a geoserver terrain server.
     *
     * @alias GeoserverTerrainProvider
     * @constructor
     *
     * @param {String}
     *            description.url The URL of the geoserver terrain server.
     * @param {String}
     *            description.layerName The layers to include, separated by
     *            commas.
     * @param {Proxy}
     *            [description.proxy] A proxy to use for requests. This object
     *            is expected to have a getURL function which returns the
     *            proxied URL, if needed.
     * @param {Credit|String}
     *            [description.credit] A credit for the data source, which is
     *            displayed on the canvas.
     * @param {Number}
     *            [description.heightMapWidth] width and height of the tiles
     * @param {Number}
     *            [description.maxLevel] max level of tiles
     * @param {String}
     *            [description.service] type of service to use (WMS, TMS or WMTS)
     * @param {String}
     *            [description.xml] the xml after requesting "getCapabilities".
     * @see TerrainProvider
     */
    var WCSTerrainProvider = function WCSTerrainProvider(description) {
        if (!Cesium.defined(description)) {
            throw new Cesium.DeveloperError('description is required.');
        }
        var errorEvent = new Cesium.Event();

        this._eventHelper = new Cesium.EventHelper();
       

        var credit = description.credit;
        if (typeof credit === 'string') {
            credit = new Cesium.Credit(credit);
        }

        this.ready = false;
		this.DefaultProvider = new Cesium.EllipsoidTerrainProvider();
		console.log("Default WH : ", this.DefaultProvider.heightMapWidth, this.DefaultProvider.heightMapHeight);


        Cesium.defineProperties(this, {
            errorEvent: {
                get: function () {
                    return errorEvent;
                }
            },
            credit: {
                get: function () {
                    return credit;
                }
            },
            hasVertexNormals: {
                get: function () {
                    return false;
                }
            }
          
        });
		description =   Cesium.defaultValue(description, Cesium.defaultValue.EMPTY_OBJECT);
        var promise =  OGCHelper.WCSParser.generate(description); 
        TerrainParser(promise, this);
    };

    WCSTerrainProvider.TiledError = function () {
        console.log("TiledError");
    };

    /**
     *
     * arrayBuffer:    the Geotiff
     * size:        number defining the height and width of the tile (can be a int or an object with two attributs: height and width)
     * childrenMask: Number defining the childrenMask
     *
     */
    WCSTerrainProvider.GeotiffToHeightmapTerrainData = function (arrayBuffer, size, x,y ,level, childrenMask,tilingSc) {
        if (typeof(size) == "number") {
            size = {width: size, height: size};
        }

        var parser = new GeotiffParser();
        parser.parseHeader(arrayBuffer);
        var width = parser.imageWidth;
        var height = parser.imageLength;
       
        //console.log("Level " , level , "w" ,size.width, "h" , size.height);

        var index=0;
        var heightBuffer = new Float32Array(size.height * size.width);
        var rect = tilingSc.tileXYToNativeRectangle(x, y, level);
        var xSpacing = (rect.east - rect.west) / size.width;
        var ySpacing = (rect.north - rect.south) / size.height;

        // Convert pixelValue to heightBuffer 
		//--------------------------------------
        // We need to return a Heighmap of size 65x65
        // The requested Tile from WCS should be cloth but not 65x65 
        // We need to work in Native coordinate then get the pixel from the Parser.

        // Here we need to check if the tilingScheme.CRS is the same of the Image 
        // If no we need to convert 
        // But It will to slow the process then we should assume tilingScheme has been set 
        // with the CRS of the image 

		
		var minH =6000;
		var maxH=0;
        for (var j=0;j<size.height;j++)
            for (var i=0;i<size.width;i++) {
				// Transform i,j of the Heighmap into res[1], res[2] of the downloaded image
				// if downloaded image is the same zize of heightBuffer this convertion wouldn't be done
                var lon = rect.west  + xSpacing * i;
                var lat = rect.north - ySpacing * j;
                var res = parser.PCSToImage(lon, lat);
                if (res[0] == 1) {
                    var pixelValue = parser.getPixelValueOnDemand(res[1], res[2]);
                    heightBuffer[index] = pixelValue[0];
					if (heightBuffer[index]<minH)
						minH=heightBuffer[index];
					if (heightBuffer[index]>maxH)
						maxH=heightBuffer[index];
                }
                else
                {
                    heightBuffer[index] = 0.0;
                }				
				index++;               
            }
			

       if (!Cesium.defined(heightBuffer)) {
            throw new Cesium.DeveloperError("no good size");
        }
        var optionsHeihtmapTerrainData = {
            buffer: heightBuffer,
            width: size.width,
            height: size.height,
            childTileMask: childrenMask
        };
       
	     //console.log("New  Cesium.HeightmapTerrainData Level " , level  ,x, y, "minH" ,minH, "maxH" , maxH);
        return new Cesium.HeightmapTerrainData(optionsHeihtmapTerrainData);
    };
	
   
    function TerrainParser(promise, provider) {
        Cesium.when(promise, function (resultat) {
             if (Cesium.defined(resultat) && (resultat.ready)) {
             
                if (Cesium.defined(resultat.urlGetCoverage)) {
                    resultat.getHeightmapTerrainDataFromWCS = function (x, y, level) {
                        var retour;
                        if (!isNaN(x + y + level)) {
                            //console.log("getHeightmapTerrainDataFromWCS",x, y, level);
                            var urlGetCoverage = templateToURL(resultat.urlGetCoverage, x, y, level, provider);
                            var hasChildren = 0;
                            if (level < resultat.maxLevel) {
                                var childLevel = level + 1;

                                hasChildren |= resultat.isInTile(2 * x, 2 * y, childLevel, provider) ? 1 : 0;
                                hasChildren |= resultat.isInTile(2 * x + 1, 2 * y, childLevel, provider) ? 2 : 0;
                                hasChildren |= resultat.isInTile(2 * x, 2 * y + 1, childLevel, provider) ? 4 : 0;
                                hasChildren |= resultat.isInTile(2 * x + 1, 2 * y + 1, childLevel, provider) ? 8 : 0;

                            }

                            var promise = Cesium.loadWithXhr({ url: urlGetCoverage, responseType: 'arraybuffer' });
                            if (Cesium.defined(promise)) {
                                retour = Cesium.when(promise, function (image) {
                                    return WCSTerrainProvider.GeotiffToHeightmapTerrainData(image,
                                        {
                                            width: resultat.heightMapWidth,
                                            height: resultat.heightMapHeight
                                        }, x, y,level, hasChildren,provider.tilingScheme);
                                }).otherwise(function () {
                                   return provider.DefaultProvider.requestTileGeometry(x, y, level);
								 
                                });
                            }
                        }
                        return retour;
                    };
                }

              

                provider.getLevelMaximumGeometricError = function (level) {
                    return resultat.levelZeroMaximumGeometricError / (1 << level);
                };

                provider.requestTileGeometry = function (x, y, level) {
                    var retour;
                  
                    if (Cesium.defined(resultat.getHeightmapTerrainDataFromWCS) &&
                        level >= resultat.minLevel &&
                        level <= resultat.maxLevel &&
                        resultat.isInTile(x, y, level, provider) == true) {
                      

                        retour = resultat.getHeightmapTerrainDataFromWCS(x, y, level);

                    }
                    else {
                        retour = provider.DefaultProvider.requestTileGeometry(x, y, level);
                        //console.log("requestTileGeometry", level);
                    }
                    return retour;
                }

                Cesium.defineProperties(provider, {
                    tilingScheme: {
                        get: function () {
                            return resultat.tilingScheme;
                        }
                    },
                    ready: {
                        get: function () {
                            return resultat.ready;
                        }
                    },
                    pixelSize: {
                        get: function () {
                            return resultat.pixelSize;
                        }
                    },
                    hasWaterMask: {
                        get: function () {
                            return resultat.waterMask;
                        }
                    },
                    heightMapHeight: {

                        get: function () {
                            return resultat.heightMapHeight;
                        }
                    },
                    heightMapWidth: {
                        get: function () {
                             return resultat.heightMapWidth;
                        }
                    },
                    getTileDataAvailable: {
                        get: function () {
                            return resultat.getTileDataAvailable;
                        }
                    },
                    minLevel: {
                        get: function () {
                            return resultat.minLevel;
                        }
                    },
                    maxLevel: {
                        get: function () {
                            return resultat.maxLevel;
                        }
                    }

                });


				// Test pour savoir dans quelle tuile se trouve mon WCS
                /*var bbox = resultat.bbox;
                var pgeo = new Cesium.Cartographic(
                    Cesium.Math.toRadians(bbox.coord[bbox.ulidx][0]),
                    Cesium.Math.toRadians(bbox.coord[bbox.ulidx][1]), 
                     0);*/
                resultat.minLevel = 30;
                resultat.maxLevel = 0;

                for (var j = 0 ; j < 30 ; j++)
                {
                   // var tile = provider.tilingScheme.positionToTileXY(pgeo,j);
					//var rect = provider.tilingScheme.tileXYToNativeRectangle(tile.x, tile.y, j);
					var rect = provider.tilingScheme.tileXYToNativeRectangle(0, 0, j);
                    var xSpacing = (rect.east - rect.west) / (provider.heightMapWidth - 1);
                    var ySpacing = (rect.north - rect.south) / (provider.heightMapHeight - 1);
                    var scalingX = provider.pixelSize[0] / xSpacing
                    var scalingY = provider.pixelSize[1] / ySpacing;
                   // console.log("Show Tile of my UL DTM Level " + j, tile.x, tile.y, scalingX, scalingY);
					console.log(" DTM Level " + j, 0, 0, scalingX, scalingY);
                  
                    if (scalingX < 10 && scalingX > 1 / 10 && Math.abs(scalingY) < 10 && Math.abs(scalingY) > 1 / 10)
                     {
                        if (j < resultat.minLevel) resultat.minLevel = j;
                        if (j > resultat.maxLevel) resultat.maxLevel = j;
                        	
                    }
                }
				// resultat.minLevel = 12;
				// resultat.maxLevel = 14;
                console.log("Show DTM Between evel ", resultat.minLevel, resultat.maxLevel);
            }
        });
    }

    function templateToURL(urlParam, x, y, level, provider) {
        var rect = provider.tilingScheme.tileXYToNativeRectangle(x, y, level);
        var xSpacing = (rect.east - rect.west) / (provider.heightMapWidth - 1);
        var ySpacing = (rect.north - rect.south) / (provider.heightMapHeight - 1);
        var scalingX = provider.pixelSize[0] / xSpacing
        var scalingY = provider.pixelSize[1] / ySpacing;
     
        rect.west -= xSpacing * 0.5;
        rect.east += xSpacing * 0.5;
        rect.south -= ySpacing * 0.5;
        rect.north += ySpacing * 0.5;
        
 
        return urlParam.replace("{south}", rect.south).replace("{north}", rect.north).replace("{west}", rect.west).replace("{east}", rect.east).replace("{scaleX}", scalingX).replace("{scaleY}", scalingY);
      }

   

    Cesium.WCSTerrainProvider = WCSTerrainProvider;
})();