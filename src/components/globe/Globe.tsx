"use client";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useEffect, useRef, useState } from "react";
import type { Cartesian2, Entity, ImageryLayer, Primitive, Viewer } from "cesium";
import type { ActivityGeo } from "@/lib/types";
import type { HeatmapImage } from "@/lib/heatmap";
import { colorForYear, yearOf } from "@/lib/colors";

type CesiumModule = typeof import("cesium");

type Props = {
  activities: ActivityGeo[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  showRoutes?: boolean;
  heatmap?: HeatmapImage | null;
  marker?: { lon: number; lat: number } | null;
  pickMode?: boolean;
  onPick?: (point: { lat: number; lon: number }) => void;
  analysis?: { lat: number; lon: number; radius: number } | null;
  highlightIds?: number[];
};

function toPositions(Cesium: CesiumModule, coords: number[]) {
  const flat: number[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    flat.push(coords[i]);
    flat.push(coords[i + 1]);
    flat.push(12); // petite altitude pour éviter le z-fighting avec les tuiles
  }
  return Cesium.Cartesian3.fromDegreesArrayHeights(flat);
}

export default function Globe({
  activities,
  selectedId,
  onSelect,
  showRoutes = true,
  heatmap = null,
  marker = null,
  pickMode = false,
  onPick,
  analysis = null,
  highlightIds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const primitiveRef = useRef<Primitive | null>(null);
  const highlightRef = useRef<Entity | null>(null);
  const heatLayerRef = useRef<ImageryLayer | null>(null);
  const markerRef = useRef<Entity | null>(null);
  const analysisEntitiesRef = useRef<Entity[]>([]);
  const passEntitiesRef = useRef<Entity[]>([]);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  const pickModeRef = useRef(pickMode);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  // Création du globe
  useEffect(() => {
    let cancelled = false;
    let viewer: Viewer | null = null;

    (async () => {
      (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium";
      const Cesium = await import("cesium");
      if (cancelled || !containerRef.current) return;

      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        timeline: false,
        animation: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        sceneModePicker: true,
      });

      const baseLayer = viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        })
      );
      baseLayer.brightness = 0.45;
      baseLayer.contrast = 1.15;
      baseLayer.saturation = 0.4;

      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b1220");
      viewer.scene.globe.showGroundAtmosphere = true;

      viewer.screenSpaceEventHandler.setInputAction(
        (movement: { position: Cartesian2 }) => {
          // Mode analyse d'un point : le clic donne une coordonnée sur le globe
          if (pickModeRef.current) {
            const cartesian = viewer!.camera.pickEllipsoid(
              movement.position,
              viewer!.scene.globe.ellipsoid
            );
            if (cartesian) {
              const carto = Cesium.Cartographic.fromCartesian(cartesian);
              onPickRef.current?.({
                lat: Cesium.Math.toDegrees(carto.latitude),
                lon: Cesium.Math.toDegrees(carto.longitude),
              });
            }
            return;
          }

          const picked = viewer!.scene.pick(movement.position);
          if (!picked) {
            onSelectRef.current(null);
            return;
          }
          if (picked.primitive === primitiveRef.current && typeof picked.id === "string") {
            onSelectRef.current(Number(picked.id));
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );

      cesiumRef.current = Cesium;
      viewerRef.current = viewer;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      cesiumRef.current = null;
      primitiveRef.current = null;
      highlightRef.current = null;
      heatLayerRef.current = null;
      markerRef.current = null;
      analysisEntitiesRef.current = [];
      passEntitiesRef.current = [];
      fittedRef.current = false;
      setReady(false);
    };
  }, []);

  // Dessin de tous les parcours visibles
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    if (primitiveRef.current) {
      viewer.scene.primitives.remove(primitiveRef.current);
      primitiveRef.current = null;
    }
    if (!showRoutes) return;

    const valid = activities.filter((a) => a.coords.length >= 4);
    if (valid.length === 0) return;

    const instances = valid.map((a) => {
      const color = Cesium.Color.fromCssColorString(colorForYear(yearOf(a.start_time)));
      return new Cesium.GeometryInstance({
        id: String(a.id),
        geometry: new Cesium.PolylineGeometry({
          positions: toPositions(Cesium, a.coords),
          width: 3,
          vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
      });
    });

    const primitive = new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PolylineColorAppearance(),
      asynchronous: true,
    });
    viewer.scene.primitives.add(primitive);
    primitiveRef.current = primitive;
  }, [ready, activities, showRoutes]);

  // Cadrage de la caméra (une seule fois)
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer || fittedRef.current) return;

    const valid = activities.filter((a) => a.coords.length >= 4);
    if (valid.length === 0) return;
    fittedRef.current = true;

    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const a of valid) {
      for (let i = 0; i < a.coords.length; i += 2) {
        const lon = a.coords[i];
        const lat = a.coords[i + 1];
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
    const margin = Math.max(0.05, (maxLon - minLon + (maxLat - minLat)) * 0.15);
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        minLon - margin,
        minLat - margin,
        maxLon + margin,
        maxLat + margin
      ),
      duration: 2.5,
    });
  }, [ready, activities]);

  // Surbrillance du parcours sélectionné
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    if (highlightRef.current) {
      viewer.entities.remove(highlightRef.current);
      highlightRef.current = null;
    }
    if (selectedId === null || !showRoutes) return;
    const selected = activities.find((a) => a.id === selectedId);
    if (!selected || selected.coords.length < 4) return;

    highlightRef.current = viewer.entities.add({
      polyline: {
        positions: toPositions(Cesium, selected.coords),
        width: 6,
        material: Cesium.Color.WHITE,
      },
    });
  }, [ready, selectedId, activities, showRoutes]);

  // Parcours passés par le point analysé
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    for (const entity of passEntitiesRef.current) viewer.entities.remove(entity);
    passEntitiesRef.current = [];

    if (!highlightIds || highlightIds.length === 0) return;
    const wanted = new Set(highlightIds);
    for (const a of activities) {
      if (!wanted.has(a.id) || a.coords.length < 4) continue;
      passEntitiesRef.current.push(
        viewer.entities.add({
          polyline: {
            positions: toPositions(Cesium, a.coords),
            width: 4,
            material: Cesium.Color.WHITE.withAlpha(0.9),
          },
        })
      );
    }
  }, [ready, highlightIds, activities]);

  // Cercle d'analyse
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    for (const entity of analysisEntitiesRef.current) viewer.entities.remove(entity);
    analysisEntitiesRef.current = [];

    if (!analysis) return;

    const position = Cesium.Cartesian3.fromDegrees(analysis.lon, analysis.lat);
    const teal = Cesium.Color.fromCssColorString("#2dd4bf");

    analysisEntitiesRef.current.push(
      viewer.entities.add({
        position,
        ellipse: {
          semiMajorAxis: analysis.radius,
          semiMinorAxis: analysis.radius,
          height: 4,
          material: teal.withAlpha(0.2),
          outline: true,
          outlineColor: teal,
        },
      }),
      viewer.entities.add({
        position,
        point: {
          pixelSize: 9,
          color: teal,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    );
  }, [ready, analysis]);

  // Carte de chaleur (couche d'image posée sur le globe)
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    let cancelled = false;

    if (heatLayerRef.current) {
      viewer.imageryLayers.remove(heatLayerRef.current, true);
      heatLayerRef.current = null;
    }
    if (!heatmap) return;

    (async () => {
      const provider = await Cesium.SingleTileImageryProvider.fromUrl(heatmap.url, {
        rectangle: Cesium.Rectangle.fromDegrees(
          heatmap.west,
          heatmap.south,
          heatmap.east,
          heatmap.north
        ),
      });
      if (cancelled || viewer.isDestroyed()) return;
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = 0.95;
      heatLayerRef.current = layer;
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, heatmap]);

  // Marqueur de position (survol des graphiques)
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    if (!marker) {
      if (markerRef.current) markerRef.current.show = false;
      return;
    }

    const position = Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 20);
    if (!markerRef.current) {
      markerRef.current = viewer.entities.add({
        position,
        point: {
          pixelSize: 13,
          color: Cesium.Color.fromCssColorString("#2dd4bf"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      markerRef.current.position = new Cesium.ConstantPositionProperty(position);
      markerRef.current.show = true;
    }
  }, [ready, marker]);

  return <div ref={containerRef} className="h-full w-full" />;
}
