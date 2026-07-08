import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Check, ChevronDown } from 'lucide-react';

export default function MobileSelect({ value, onValueChange, options = [], placeholder, id }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || 'Select';

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={value ? '' : 'text-muted-foreground'}>{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[60vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{placeholder || 'Select an option'}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto overscroll-none px-2 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[45vh]">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onValueChange?.(opt.value);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm rounded-lg hover:bg-accent transition-colors"
            >
              <span className={value === opt.value ? 'font-semibold text-primary' : ''}>{opt.label}</span>
              {value === opt.value && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}