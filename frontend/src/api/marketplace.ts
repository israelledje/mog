import { api } from './client';

export type MarketplaceProduct = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  price_xaf: number;
  currency?: string;
  images?: string[];
  stock?: number;
  transport_mode?: string;
  origin_city?: string;
  status?: string;
  specs?: Record<string, any>;
};

export type MarketplaceOrder = {
  id: string;
  product_title?: string;
  quantity?: number;
  total_xaf?: number;
  tracking_number?: string;
  status?: string;
  payment_status?: string;
  created_at?: string;
};

export const marketplaceApi = {
  listProducts(params?: { category?: string; q?: string; status?: string }) {
    return api.get<MarketplaceProduct[]>('/marketplace/products', { params }).then((r) => r.data);
  },
  getProduct(id: string) {
    return api.get<MarketplaceProduct>(`/marketplace/products/${id}`).then((r) => r.data);
  },
  createProduct(payload: Partial<MarketplaceProduct> & { title: string; price_xaf: number }) {
    return api.post('/marketplace/products', payload).then((r) => r.data);
  },
  updateProduct(id: string, payload: Partial<MarketplaceProduct>) {
    return api.patch(`/marketplace/products/${id}`, payload).then((r) => r.data);
  },
  archiveProduct(id: string) {
    return api.delete(`/marketplace/products/${id}`).then((r) => r.data);
  },
  purchase(payload: {
    product_id: string;
    quantity?: number;
    promo_code?: string;
    delivery_city?: string;
    notes?: string;
  }) {
    return api.post('/marketplace/purchase', payload).then((r) => r.data);
  },
  myOrders() {
    return api.get<MarketplaceOrder[]>('/marketplace/orders/mine').then((r) => r.data);
  },
  listOrders() {
    return api.get<MarketplaceOrder[]>('/marketplace/orders').then((r) => r.data);
  },
};
