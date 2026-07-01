/** Adresse entrepôt MOG en Chine (Foshan) */
export const CHINA_WAREHOUSE_ADDRESS = `收件人 : MOG
电话 : 18802010441
导航输入 : MOG
地址 : 广东省佛山市南海区大步村发展路1号
( 天福药业有限公司院内2号楼 )`;

export function buildWarehouseClipboardText(params: {
  clientCode?: string | null;
  fullName?: string | null;
  phone?: string | null;
  city?: string | null;
}): string {
  const mark = [
    '1- M.O.G',
    `2- NAME: ${params.fullName || 'CLIENT'}`,
    `3- PHONE: ${params.phone || ''}`,
    `4- CITY: ${params.city || ''}`,
    params.clientCode ? `5- CODE: ${params.clientCode}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${mark}\n\n${CHINA_WAREHOUSE_ADDRESS}\n\n注意 : 必须写上客户的唛头\n拒收到付件!!!`;
}
