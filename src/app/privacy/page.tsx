import type { Metadata } from "next";
import { PrivacyPolicyContent } from "@/src/components/privacy-policy-content";

export const metadata: Metadata = { title: "Privacy Policy · MyPlanner" };

const publisherValue = process.env.NEXT_PUBLIC_PUBLISHER_NAME?.trim();
const supportEmailValue = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
const publisher = publisherValue && !publisherValue.toLowerCase().startsWith("replace-with-") && publisherValue !== "Your publisher name" ? publisherValue : undefined;
const supportEmail = supportEmailValue && !supportEmailValue.toLowerCase().startsWith("replace-with-") && supportEmailValue !== "support@example.com" ? supportEmailValue : undefined;

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent publisher={publisher} supportEmail={supportEmail} />;
}
