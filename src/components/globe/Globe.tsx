"use client";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useEffect, useRef, useState } from "react";
import type { Cartesian2, Viewer } from "cesium";
import type { ActivityGeo } from "@/lib/types";
import { colorForYear, yearOf } from "@/lib/colors";

type CesiumModule = typeof import("cesium");

type Props = {
  activities: ActivityGeo[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
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

export default function Globe({ activities, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const primitiveRef = useRef<unknown>(null);
  const highlightRef = useRef<unknown>(null);
  const onSelectRef = useRef(onSelect);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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

    if (!fittedRef.current) {
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
    }
  }, [ready, activities]);

  // Surbrillance du parcours sélectionné
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !Cesium || !viewer) return;

    if (highlightRef.current) {
      viewer.entities.remove(highlightRef.current as never);
      highlightRef.current = null;
    }
    if (selectedId === null) return;
    const selected = activities.find((a) => a.id === selectedId);
    if (!selected || selected.coords.length < 4) return;

    highlightRef.current = viewer.entities.add({
      polyline: {
        positions: toPositions(Cesium, selected.coords),
        width: 6,
        material: Cesium.Color.WHITE,
      },
    });
  }, [ready, selectedId, activities]);

  return <div ref={containerRef} className="h-full w-full" />;
}
