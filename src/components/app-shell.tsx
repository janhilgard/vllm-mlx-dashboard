"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dashboard } from "./dashboard";
import { ChatPanel } from "./chat/chat-panel";
import { BarChart3, MessageSquare } from "lucide-react";

export function AppShell() {
  return (
    <Tabs defaultValue="monitor" className="px-6">
      <TabsList>
        <TabsTrigger value="monitor" className="gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Monitor
        </TabsTrigger>
        <TabsTrigger value="chat" className="gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Chat
        </TabsTrigger>
      </TabsList>

      <TabsContent value="monitor" className="-mx-6">
        <Dashboard />
      </TabsContent>

      <TabsContent value="chat" className="-mx-6">
        <ChatPanel />
      </TabsContent>
    </Tabs>
  );
}
