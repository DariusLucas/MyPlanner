import { notFound } from "next/navigation";

const sections: Record<string, { title: string; description: string }> = {
  career: { title: "Career", description: "Career work will appear here once it is connected to your weekly tasks." },
  content: { title: "Content", description: "Content work will appear here once it is connected to your weekly tasks." },
  progress: { title: "Progress", description: "Progress will be based on completed work once there is enough activity to show." },
  settings: { title: "Settings", description: "Theme controls are available in the sidebar. Additional settings will be introduced only when they support an active workflow." },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section];
  if (!content) notFound();

  return <section className="mx-auto flex min-h-[360px] max-w-xl flex-col justify-center"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em]">{content.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{content.description}</p></section>;
}
