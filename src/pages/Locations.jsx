import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LocationPresetManager from '@/components/locations/LocationPresetManager';

export default function Locations() {
  return (
    <div>
      <PageHeader title="Location Presets" subtitle="Named zones for trip start/end matching" />
      <LocationPresetManager />
    </div>
  );
}