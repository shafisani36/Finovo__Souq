import {
  Armchair,
  BedDouble,
  Bike,
  Building2,
  Camera,
  CarFront,
  Cog,
  CookingPot,
  Gamepad2,
  GraduationCap,
  Hammer,
  LandPlot,
  Laptop,
  Lamp,
  Smartphone,
  Sofa,
  Sparkles,
  Store,
  Tag,
  Truck,
  Tv,
  Wrench,
  MonitorSmartphone,
  type LucideProps,
} from 'lucide-react';
import type { CategoryIconKey } from '../../types';

const CATEGORY_ICONS: Record<CategoryIconKey, typeof Tag> = {
  car: CarFront,
  motorcycle: Bike,
  parts: Cog,
  property: Building2,
  land: LandPlot,
  store: Store,
  electronics: MonitorSmartphone,
  phone: Smartphone,
  laptop: Laptop,
  tv: Tv,
  camera: Camera,
  gaming: Gamepad2,
  furniture: Armchair,
  sofa: Sofa,
  bed: BedDouble,
  kitchen: CookingPot,
  decor: Lamp,
  services: Wrench,
  cleaning: Sparkles,
  truck: Truck,
  tools: Hammer,
  education: GraduationCap,
  tag: Tag,
};

export function CategoryIcon({ icon, ...props }: { icon: CategoryIconKey } & LucideProps) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  return <Icon {...props} />;
}
