import DOMPurify from "dompurify";
import { marked } from "marked";
import { createMemo } from "solid-js";
import { assetUrl } from "~/api/client";

const ASSET_SRC = /(src=")\.\.\/\.assets\/([^"]+)/g;

export default function MarkdownPreview(props: { body: string }) {
  const html = createMemo(() =>
    DOMPurify.sanitize(
      (marked.parse(props.body, { async: false }) as string).replace(
        ASSET_SRC,
        (_, attr, name) => `${attr}${assetUrl(name)}`,
      ),
    ),
  );

  return <div class="markdown-preview" innerHTML={html()} />;
}
