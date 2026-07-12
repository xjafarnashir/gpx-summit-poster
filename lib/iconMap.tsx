import {
  AtSign,
  Calendar,
  Camera,
  Cloud,
  Footprints,
  Mountain,
  MountainSnow,
  Music2,
  QrCode,
  Ruler,
  Thermometer,
  Timer,
  User,
  MapPin,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps each stat-card field to an SVG icon component (Lucide), replacing the
 * emoji used in the design brief. Emoji rendering is inconsistent across
 * OSes and can break during PNG export, so every field gets a real icon.
 */
export const STAT_ICONS = {
  distance: Ruler, // 📏
  elevationGain: Mountain, // ⛰
  movingTime: Timer, // ⏱
  avgPace: Footprints, // 🚶
  temperature: Thermometer, // 🌡
  weather: Cloud, // ☁
  climberName: User, // 👤
  mountainName: MountainSnow, // 🏔
  date: Calendar, // 🗓
  viaRoute: MapPin, // 📍
  photo: Camera, // 📷
  instagram: AtSign, // 📱
  tiktok: Music2, // 🎵
  qrCode: QrCode, // ⬛
} satisfies Record<string, LucideIcon>;

export type StatIconKey = keyof typeof STAT_ICONS;
