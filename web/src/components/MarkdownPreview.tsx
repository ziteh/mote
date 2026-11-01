import DOMPurify from "dompurify";
import { marked } from "marked";
import { createMemo } from "solid-js";

const ASSET_PREFIX = /(src=")\.\.\/\.assets\//g;

export default function MarkdownPreview(props: { body: string }) {
  const html = createMemo(() =>
    DOMPurify.sanitize(
      (marked.parse(props.body, { async: false }) as string).replace(
        ASSET_PREFIX,
        "$1/api/assets/",
      ),
    ),
  );

  return <div class="markdown-preview" innerHTML={html()} />;
}
