"use client";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ResourcePage } from "@/components/resource-page";
import { Loading } from "@/components/common";
import { Profile } from "@/components/profile";

const Manual = dynamic(() => import("@/components/manual").then((module) => module.Manual), {
  loading: Loading,
});

export default function Page() {
  const { resource } = useParams<{ resource: string }>();
  if (resource === "manual") return <Manual />;
  if (resource === "profile") return <Profile />;
  return <ResourcePage key={resource} resourceKey={resource} />;
}
