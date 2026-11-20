// Penanda halaman yang isinya dikerjakan di tahap berikutnya (lihat docs/PROMPTS.md).
export function ComingSoon({ title, tahap }: { title: string; tahap: string }) {
  return (
    <section className="neu-raised mx-auto mt-10 max-w-xl rounded-3xl p-8 text-center sm:mt-14">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Halaman ini dikerjakan di {tahap}.</p>
    </section>
  );
}
