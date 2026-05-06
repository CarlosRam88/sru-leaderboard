interface Props {
  type: 'error' | 'info' | 'warning';
  message: string;
}

const styles = {
  error:   'bg-red-500/10 text-red-400 border-red-500/30',
  info:    'bg-bip-accent/10 text-bip-accent border-bip-accent/30',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

export default function StatusMessage({ type, message }: Props) {
  return (
    <div className={`px-4 py-3 rounded border text-sm ${styles[type]}`}>{message}</div>
  );
}
