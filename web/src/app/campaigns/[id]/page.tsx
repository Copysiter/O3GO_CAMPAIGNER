"use client";
import { useParams } from "next/navigation";
import { CampaignDetail } from "@/components/campaign-detail";
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CampaignDetail key={id} id={Number(id)} />;
}
