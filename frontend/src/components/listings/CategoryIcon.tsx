import { Armchair, Building2, CarFront, Smartphone, Wrench, type LucideProps } from 'lucide-react';
import type { CategoryIconKey } from '../../types';

const ICONS = {
  car: CarFront,
  property: Building2,
  electronics: Smartphone,
  furniture: Armchair,
  services: Wrench,
} as const;

export function CategoryIcon({ icon, ...props }: { icon: CategoryIconKey } & LucideProps) {
  const Icon = ICONS[icon];
  return <Icon {...props} />;
}
