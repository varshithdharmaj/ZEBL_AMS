"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PRE_LOGIN_FAQ } from "@/lib/help/content/pre-login-faq";

export function PreLoginHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
          Need help signing in?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Signing in — help</DialogTitle>
          <DialogDescription>Common questions before you&apos;re signed in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {PRE_LOGIN_FAQ.map((item) => (
            <div key={item.question}>
              <p className="mb-1 text-sm font-semibold text-foreground">{item.question}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
