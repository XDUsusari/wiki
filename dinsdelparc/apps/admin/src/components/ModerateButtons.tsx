import { moderate } from '@/app/(panel)/moderation/actions';

export function ModerateButtons({
  target,
  id,
  current,
  back,
  labels,
}: {
  target: string;
  id: string;
  current: string;
  back: string;
  labels: { hide: string; restore: string; remove: string; note: string };
}) {
  return (
    <form action={moderate} className="row">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <input type="text" name="note" placeholder={labels.note} aria-label={labels.note} style={{ maxWidth: 200 }} />
      {current !== 'visible' ? (
        <button className="btn sm secondary" name="status" value="visible">
          {labels.restore}
        </button>
      ) : null}
      {current !== 'hidden' ? (
        <button className="btn sm" name="status" value="hidden">
          {labels.hide}
        </button>
      ) : null}
      {current !== 'removed' ? (
        <button className="btn sm danger" name="status" value="removed">
          {labels.remove}
        </button>
      ) : null}
    </form>
  );
}
