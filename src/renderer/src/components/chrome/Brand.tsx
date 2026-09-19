import { APP_NAME } from '@shared/constants'
import icon from '../../assets/pagesprig-icon.svg'
import styles from './Brand.module.css'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  wordmark?: boolean
}

export function BrandLockup({ size = 'md', wordmark = true }: Props) {
  return (
    <div className={`${styles.lockup} ${styles[size]}`}>
      <img src={icon} alt={wordmark ? '' : APP_NAME} width={40} height={40} draggable={false} />
      {wordmark && (
        <span className={styles.word}>
          Page<span className={styles.leaf}>Sprig</span>
        </span>
      )}
    </div>
  )
}
