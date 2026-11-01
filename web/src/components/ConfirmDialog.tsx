import { t } from "~/lib/i18n";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export default function ConfirmDialog(props: Props) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{props.title}</AlertDialogTitle>
        <AlertDialogDescription>{props.description}</AlertDialogDescription>
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={props.onConfirm}>
            {props.confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
