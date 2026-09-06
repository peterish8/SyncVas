import { absoluteUrl } from "@/lib/site-url";

export function SiteStructuredData() {
  const organizationId = `${absoluteUrl("/")}#organization`;
  const websiteId = `${absoluteUrl("/")}#website`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Syncvas",
        url: absoluteUrl("/"),
        description: "A live classroom whiteboard for teacher-led lessons.",
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "Syncvas",
        url: absoluteUrl("/"),
        description: "Live classroom whiteboarding for teachers and students.",
        publisher: { "@id": organizationId },
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        name: "Syncvas live classroom whiteboard",
        url: absoluteUrl("/"),
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web browser",
        browserRequirements: "Requires a modern browser with JavaScript enabled",
        description:
          "Teachers write on a live whiteboard while students join by QR code or short code, follow the lesson, and ask anonymous doubts.",
        featureList: [
          "Teacher-led live whiteboard",
          "QR code and short-code classroom joining",
          "Independent student pan and zoom",
          "Follow Teacher viewport mode",
          "Anonymous classroom doubts",
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
