import React from 'react';
import {
  Layout,
  Plus,
  Search,
  Settings,
  X,
  ExternalLink,
  Briefcase,
  Code,
  PenTool,
  Globe,
  Star,
  Clock,
  ChevronLeft,
  Menu,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

const iconMap = {
  layout: Layout,
  plus: Plus,
  search: Search,
  settings: Settings,
  x: X,
  externalLink: ExternalLink,
  briefcase: Briefcase,
  code: Code,
  penTool: PenTool,
  globe: Globe,
  star: Star,
  clock: Clock,
  chevronLeft: ChevronLeft,
  menu: Menu,
  checkCircle2: CheckCircle2,
  trash2: Trash2,
};

export default function IconRenderer({ name, size = 18, className = '' }) {
  const IconComponent = iconMap[name] || Briefcase;
  return <IconComponent size={size} className={className} />;
}
