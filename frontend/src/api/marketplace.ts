import { api } from './client';

export type MarketplaceVariant = {
  id: string;
  name: string;
  sku?: string;
  price_xaf?: number | null;
  stock?: number;
  attributes?: Record<string, any>;
};

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
  variants?: MarketplaceVariant[];
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  cbm?: number | null;
  dimensions_label?: string;
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
    variant_id?: string;
    quantity?: number;
    promo_code?: string;
    delivery_city?: string;
    notes?: string;
  }) {
    return api.post('/marketplace/checkout', payload).then((r) => r.data);
  },
  createCheckout(payload: {
    product_id: string;
    variant_id?: string;
    quantity?: number;
    promo_code?: string;
    delivery_city?: string;
    notes?: string;
  }) {
    return api.post('/marketplace/checkout', payload).then((r) => r.data);
  },
  getCheckout(id: string) {
    return api.get(`/marketplace/checkout/${id}`).then((r) => r.data);
  },
  payCheckout(id: string, payload: { method: 'om' | 'momo' | 'bank'; phone?: string; reference?: string }) {
    return api.post(`/marketplace/checkout/${id}/pay`, payload).then((r) => r.data);
  },
  pendingCheckouts() {
    return api.get('/marketplace/checkouts/pending').then((r) => r.data);
  },
  confirmCheckout(id: string) {
    return api.post(`/marketplace/checkout/${id}/confirm`).then((r) => r.data);
  },
  adjustStock(id: string, payload: { stock?: number; delta?: number; variant_id?: string }) {
    return api.patch(`/marketplace/products/${id}/stock`, payload).then((r) => r.data);
  },
  uploadImage(uri: string) {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('file', { uri, name: filename, type } as any);
    return api.post('/marketplace/products/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data as { url: string });
  },
  myOrders() {
    return api.get<MarketplaceOrder[]>('/marketplace/orders/mine').then((r) => r.data);
  },
  listOrders() {
    return api.get<MarketplaceOrder[]>('/marketplace/orders').then((r) => r.data);
  },
};
