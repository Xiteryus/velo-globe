import { Decoder, Stream } from "@garmin/fitsdk";
import type { ParsedActivity, TrackPoint } from "./types";

const SEMICIRCLES_TO_DEG = 180 / 2 ** 31;

export function parseFit(buf: Buffer): ParsedActivity {
  const stream = Stream.fromBuffer(buf);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) throw new Error("Fichier FIT invalide");

  const { messages, errors } = decoder.read();
  if (errors.length > 0 && !messages.recordMesgs?.length) {
    throw new Error("Lecture FIT impossible : " + String(errors[0]));
  }

  const points: TrackPoint[] = [];
  for (const rec of messages.recordMesgs ?? []) {
    if (rec.positionLat == null || rec.positionLong == null) continue;
    points.push({
      lat: rec.positionLat * SEMICIRCLES_TO_DEG,
      lon: rec.positionLong * SEMICIRCLES_TO_DEG,
      ele: rec.enhancedAltitude ?? rec.altitude ?? null,
      t: rec.timestamp ? new Date(rec.timestamp).getTime() : null,
      hr: rec.heartRate ?? null,
      speed: rec.enhancedSpeed ?? rec.speed ?? null,
    });
  }

  if (points.length < 2) {
    throw new Error("Aucun tracé GPS exploitable dans ce fichier FIT");
  }

  const session = messages.sessionMesgs?.[0] ?? {};
  const start = session.startTime ? new Date(session.startTime) : new Date(points[0].t ?? Date.now());

  return {
    name: "Sortie vélo",
    sport: session.sport ? String(session.sport) : null,
    startTime: start.toISOString(),
    durationS: session.totalElapsedTime ?? null,
    movingTimeS: session.totalTimerTime ?? null,
    distanceM: session.totalDistance ?? null,
    elevationGainM: session.totalAscent ?? null,
    avgSpeedMs: session.enhancedAvgSpeed ?? session.avgSpeed ?? null,
    maxSpeedMs: session.enhancedMaxSpeed ?? session.maxSpeed ?? null,
    avgHr: session.avgHeartRate ?? null,
    maxHr: session.maxHeartRate ?? null,
    calories: session.totalCalories ?? null,
    points,
  };
}