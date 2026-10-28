import React from 'react';
import {
  Camera,
  Video,
  Play,
  MessageCircle,
  Gamepad2,
  ShoppingBag,
  Globe,
  Tv,
  Smartphone,
} from 'lucide-react';
import { AndroidAppItem } from '../data/androidApps';

export function AppIconBadge({
  iconType,
  color,
  size = 'md',
}: {
  iconType: AndroidAppItem['iconType'];
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimensions =
    size === 'sm' ? 'w-9 h-9 rounded-xl' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-11 h-11 rounded-xl';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  const renderIcon = () => {
    switch (iconType) {
      case 'instagram':
        return <Camera className={`${iconSize} text-white`} />;
      case 'tiktok':
        return <Video className={`${iconSize} text-white`} />;
      case 'youtube':
        return <Play className={`${iconSize} text-white fill-current`} />;
      case 'twitter':
        return <MessageCircle className={`${iconSize} text-white`} />;
      case 'game':
        return <Gamepad2 className={`${iconSize} text-white`} />;
      case 'shopping':
        return <ShoppingBag className={`${iconSize} text-white`} />;
      case 'reddit':
        return <Globe className={`${iconSize} text-white`} />;
      case 'netflix':
        return <Tv className={`${iconSize} text-white`} />;
      default:
        return <Smartphone className={`${iconSize} text-white`} />;
    }
  };

  return (
    <div
      className={`${dimensions} flex items-center justify-center shrink-0 shadow-xs`}
      style={{ backgroundColor: color }}
    >
      {renderIcon()}
    </div>
  );
}
