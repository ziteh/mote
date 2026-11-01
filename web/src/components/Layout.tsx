import { useContext as useResizableContext } from "@corvu/resizable";
import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { useRescan } from "~/api/queries";
import ListIcon from "~/assets/list.svg";
import SidebarIcon from "~/assets/sidebar.svg";
import { useFilters } from "~/lib/filters";
import { t } from "~/lib/i18n";
import { createIsDesktop } from "~/lib/media";
import { panelSizes, setPanelSizes } from "~/lib/panel-sizes";
import NoteList from "./NoteList";
import NotePane from "./NotePane";
import Sidebar from "./Sidebar";
import { Button } from "./ui/button";
import { Resizable, ResizableHandle, ResizablePanel } from "./ui/resizable";

const SIDEBAR_SIZE = 0.18;
const LIST_SIZE = 0.3;
const MIN_PANEL_SIZE = 0.12;

export default function Layout() {
  const params = useParams<{ id?: string }>();
  const isDesktop = createIsDesktop();
  const rescan = useRescan();

  onMount(() => {
    const onFocus = () => void rescan();
    window.addEventListener("focus", onFocus);
    onCleanup(() => window.removeEventListener("focus", onFocus));
  });

  return (
    <div class="h-full">
      <Show when={isDesktop()} fallback={<MobileLayout id={params.id} />}>
        <Resizable sizes={panelSizes()} onSizesChange={setPanelSizes}>
          <PanelToggles />
          <ResizablePanel
            class="overflow-hidden"
            initialSize={SIDEBAR_SIZE}
            minSize={MIN_PANEL_SIZE}
            collapsible
          >
            <Sidebar />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            class="overflow-hidden"
            initialSize={LIST_SIZE}
            minSize={MIN_PANEL_SIZE}
            collapsible
          >
            <NoteList selectedId={params.id} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            initialSize={1 - SIDEBAR_SIZE - LIST_SIZE}
            minSize={MIN_PANEL_SIZE}
          >
            <NotePane id={params.id} />
          </ResizablePanel>
        </Resizable>
      </Show>
    </div>
  );
}

/** Rail that stays visible so collapsed panels can be brought back. */
function PanelToggles() {
  const resizable = useResizableContext();

  const toggle = (index: number) =>
    resizable.sizes()[index] === 0
      ? resizable.expand(index, "following")
      : resizable.collapse(index, "following");

  return (
    <div class="flex w-9 shrink-0 flex-col items-center gap-1 border-r py-2">
      <Button
        variant="ghost"
        size="icon"
        class="size-7 [&>svg]:size-4"
        classList={{ "bg-accent": resizable.sizes()[0] !== 0 }}
        aria-label={t("toggleSidebar")}
        title={t("toggleSidebar")}
        onClick={() => toggle(0)}
      >
        <SidebarIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-7 [&>svg]:size-4"
        classList={{ "bg-accent": resizable.sizes()[1] !== 0 }}
        aria-label={t("toggleNoteList")}
        title={t("toggleNoteList")}
        onClick={() => toggle(1)}
      >
        <ListIcon />
      </Button>
    </div>
  );
}

/** One screen at a time: note, sidebar, or list. */
function MobileLayout(props: { id?: string }) {
  const [showSidebar, setShowSidebar] = createSignal(false);
  const navigate = useNavigate();
  const { update } = useFilters();

  return (
    <Show
      when={props.id === undefined}
      fallback={<NotePane id={props.id} onBack={() => update({}, "/")} />}
    >
      <Show
        when={showSidebar()}
        fallback={
          <NoteList
            onOpenSidebar={() => setShowSidebar(true)}
            onSelect={(id) => navigate(`/n/${id}${location.search}`)}
          />
        }
      >
        <div class="flex h-full flex-col">
          <div class="border-b p-2">
            <Button variant="ghost" onClick={() => setShowSidebar(false)}>
              {t("noteListBack")}
            </Button>
          </div>
          <div class="min-h-0 flex-1">
            <Sidebar onPick={() => setShowSidebar(false)} />
          </div>
        </div>
      </Show>
    </Show>
  );
}
