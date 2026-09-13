import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';
import { ErrorState } from './ErrorState';
import { trackError } from '@/data/events';
import { getDict } from '@/i18n';

/**
 * Render sırasında fırlayan bir hatayı yakalar.
 *
 * Bu olmadan React ağacın tamamını söküyor ve kullanıcı BOŞ BİR EKRAN
 * görüyor: uygulama ölmüş gibi duruyor, geri dönmenin yolu yok, ve hata
 * deterministikse (sunucudan gelen beklenmedik bir veri şekli gibi) yeniden
 * açmak da işe yaramıyor. Üstelik senin haberin olmuyor.
 *
 * İki işi var: kullanıcıya çıkış kapısı vermek, ve hatayı kaydetmek.
 *
 * Sınıf bileşeni olmak zorunda — React'te render hatasını yakalamanın hook
 * karşılığı yok.
 */
interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Tek sinyal bu: render hataları hiçbir catch bloğuna düşmüyor, bu
    // yüzden app_events'e yazılmazsa hiçbir yerde iz bırakmıyorlar.
    trackError('render', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = getDict();
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
        <ErrorState
          message={t.errors.crashTitle}
          detail={t.errors.crashBody}
          // Yeniden denemek ağacı sıfırdan kurar. Hata geçiciyse (bir kereye
          // mahsus bozuk veri) uygulama geri gelir; kalıcıysa aynı ekran
          // tekrar çıkar — ki bu da boş ekrandan iyidir, en azından ne
          // olduğu yazıyor.
          onRetry={() => this.setState({ error: null })}
        />
      </View>
    );
  }
}
