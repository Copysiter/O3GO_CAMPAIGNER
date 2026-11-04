"use client";
import { useParams } from "next/navigation";
import { ResourcePage } from "@/components/resource-page";
import { Manual } from "@/components/manual";
import { Profile } from "@/components/profile";
export default function Page() {
  const { resource } = useParams<{ resource: string }>();
  if (resource === "manual") return <Manual />;
  if (resource === "profile") return <Profile />;
  return <ResourcePage key={resource} resourceKey={resource} />;
}
