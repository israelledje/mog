import React from 'react';
import { getServiceBySlug } from '../../src/constants/services';
import ServiceFormScreen from '../../src/components/services/ServiceFormScreen';

export default function VehiclesServiceScreen() {
  const service = getServiceBySlug('vehicles')!;
  return <ServiceFormScreen service={service} />;
}
