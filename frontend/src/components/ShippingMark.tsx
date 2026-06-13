import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { Copy, Share2, FileText } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import { colors, fonts, radii, spacing, shadow } from '../constants/theme';

interface ShippingMarkProps {
  name: string;
  phone: string;
  city: string;
}

export default function ShippingMark({ name, phone, city }: ShippingMarkProps) {
  const markText = `1- M.O.G
2- NAME: ${name}
3- PHONE: ${phone}
4- CITY: ${city}`;

  const warehouseInfo = `收件人 : MOG
电话 : 18802010441
导航输入 : MOG
地址 : 广东省佛山市南海区大步村发展路1号
( 天福药业有限公司院内2号楼 )

注意 : 必须写上客户的唛头
( 客户的名字和国外的电话号码 )
拒收到付件!!!`;

  const fullText = `${markText}\n\n${warehouseInfo}`;

  const onCopy = async () => {
    await Clipboard.setStringAsync(fullText);
    Toast.show({ type: 'success', text1: 'Shipping mark copied' });
  };

  const onShare = async () => {
    try {
      await Share.share({ message: fullText });
    } catch (error) {
      console.log(error);
    }
  };

  const onDownloadPDF = async () => {
    try {
      const qrData = encodeURIComponent(`MOG|${name || 'Client'}|${phone || ''}`);
      // On utilise un & normal car l'API qrserver peut mal interpréter &amp;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background: white;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 30px;">SHIPPING MARK / 唛头</h1>
            
            <div style="border: 2px solid #000; padding: 20px; text-align: left; margin: 0 auto; width: 80%; font-size: 18px; font-weight: bold; line-height: 1.6;">
              <p style="margin: 5px 0;">1- M.O.G</p>
              <p style="margin: 5px 0;">2- NAME: ${name || 'N/A'}</p>
              <p style="margin: 5px 0;">3- PHONE: ${phone || 'N/A'}</p>
              <p style="margin: 5px 0;">4- CITY: ${city || 'N/A'}</p>
            </div>
            
            <div style="margin: 40px 0;">
              <img src="${qrUrl}" alt="QR Code" style="width: 200px; height: 200px; display: inline-block;" />
              <p style="font-size: 14px; color: #666; margin-top: 10px;">ID: ${name || 'Client'}</p>
            </div>

            <div style="text-align: left; margin: 0 auto; width: 80%; font-size: 16px; line-height: 1.5;">
              <p style="margin: 0;">收件人 : MOG</p>
              <p style="margin: 0;">电话 : 18802010441</p>
              <p style="margin: 0;">导航输入 : MOG</p>
              <p style="margin: 0;">地址 : 广东省佛山市南海区大步村发展路1号</p>
              <p style="margin: 0;">( 天福药业有限公司院内2号楼 )</p>
              
              <p style="color: red; font-weight: bold; margin-top: 20px;">注意 : 必须写上客户的唛头</p>
              <p style="color: red; font-weight: bold; margin: 0;">( 客户的名字和国外的电话号码 )</p>
              <p style="color: red; font-weight: bold; margin: 0;">拒收到付件!!!</p>
            </div>
          </body>
        </html>
      `;
      // Générer le PDF en demandant le base64 pour contourner l'impossibilité de lire le fichier cache d'Expo
      const { base64 } = await Print.printToFileAsync({ 
        html,
        base64: true
      });
      
      if (!base64) throw new Error("Le base64 du PDF n'a pas été généré.");

      // Créer un fichier lisible dans le dossier Documents
      const newUri = `${FileSystem.documentDirectory}shipping_mark_${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(newUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Télécharger Shipping Mark',
          UTI: 'com.adobe.pdf'
        });
      }
    } catch (e: any) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Erreur PDF', text2: e?.message || String(e) });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.ticket}>
        <View style={styles.ticketHeader}>
          <View>
            <Text style={styles.header}>SHIPPING MARK</Text>
            <Text style={styles.subHeader}>ID: {name || 'CLIENT'}</Text>
          </View>
          <View style={styles.qrWrap}>
            <QRCode value={`MOG|${name}|${phone}`} size={54} />
          </View>
        </View>
        
        <View style={styles.dividerContainer}>
          <View style={styles.leftCircle} />
          <View style={styles.dashedLine} />
          <View style={styles.rightCircle} />
        </View>
        
        <View style={styles.markArea}>
          <Text style={styles.line}>1- M.O.G</Text>
          <Text style={styles.line}>2- NAME: <Text style={styles.highlight}>{name}</Text></Text>
          <Text style={styles.line}>3- PHONE: <Text style={styles.highlight}>{phone}</Text></Text>
          <Text style={styles.line}>4- CITY: <Text style={styles.highlight}>{city}</Text></Text>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.leftCircle} />
          <View style={styles.dashedLine} />
          <View style={styles.rightCircle} />
        </View>

        <View style={styles.chineseArea}>
          <Text style={styles.chineseText}>收件人 : MOG</Text>
          <Text style={styles.chineseText}>电话 : 18802010441</Text>
          <Text style={styles.chineseText}>导航输入 : MOG</Text>
          <Text style={styles.chineseText}>地址 : 广东省佛山市南海区大步村发展路1号</Text>
          <Text style={styles.chineseText}>( 天福药业有限公司院内2号楼 )</Text>
          
          <Text style={styles.warning}>注意 : 必须写上客户的唛头</Text>
          <Text style={styles.warning}>( 客户的名字和国外的电话号码 )</Text>
          <Text style={styles.warning}>拒收到付件!!!</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onDownloadPDF}>
            <FileText size={18} color={colors.primary} />
            <Text style={styles.actionLabel}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
            <Copy size={18} color={colors.primary} />
            <Text style={styles.actionLabel}>Copier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
            <Share2 size={18} color={colors.primary} />
            <Text style={styles.actionLabel}>Partager</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  ticket: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...shadow.card,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  qrWrap: {
    padding: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  header: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1f2937',
    letterSpacing: 1,
    fontFamily: fonts.mono,
  },
  subHeader: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: fonts.mono,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  markArea: {
    paddingVertical: spacing.sm,
  },
  line: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
  },
  highlight: {
    color: '#000',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    marginHorizontal: -spacing.lg,
    zIndex: 1,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  leftCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    marginLeft: -10,
    borderRightWidth: 1,
    borderColor: '#e5e7eb',
  },
  rightCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    marginRight: -10,
    borderLeftWidth: 1,
    borderColor: '#e5e7eb',
  },
  chineseArea: {
    marginBottom: spacing.md,
  },
  chineseText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 2,
  },
  warning: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '700',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    backgroundColor: '#f9fafb',
    padding: spacing.md,
    borderRadius: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
