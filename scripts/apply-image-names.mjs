// Points the site at the renamed, compressed images in public/images/.
//
// Run once, after replacing public/images with the new images folder:
//
//   node scripts/apply-image-names.mjs
//
// It rewrites every image reference in src/ and content/ (whether it currently
// points at Wix, at /images/wix/..., or at the older organized names), swaps the
// blank Wix-video hero on /medical and /marketingchallenges for real photos, and
// darkens the client logos so they show on a light background.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// [original Wix URL, downloaded file name, earlier organized path, new path]
const MAP = [
  ["https://static.wixstatic.com/media/3bcff6_92ad281d3ca3438b85def2b393a75904~mv2.jpg", "3bcff6_92ad281d3ca3438b85def2b393a75904_mv2.jpg", "blog/advertise-your-phoenix-based-renewable-energy-business-with-video/cover.jpg", "blog/advertise-your-phoenix-based-renewable-energy-business-with-video/solar-farm-at-sunset.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_dcf54897b7ef48528efc9d9de18df06a~mv2.jpg", "3bcff6_dcf54897b7ef48528efc9d9de18df06a_mv2.jpg", "blog/becoming-the-world-s-first-ai-powered-marketing-agency/cover.jpg", "blog/becoming-the-world-s-first-ai-powered-marketing-agency/laptop-showing-ai-prompts.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_16ce4179eddb4f69a220f213e2458ab6~mv2.jpg", "3bcff6_16ce4179eddb4f69a220f213e2458ab6_mv2.jpg", "blog/benefits-of-harnessing-video-to-advertise-your-phoenix-based-medical-practice/cover.jpg", "blog/benefits-of-harnessing-video-to-advertise-your-phoenix-based-medical-practice/nurse-in-scrubs-portrait.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_5e6bdadb1a264c0fa2076f17cd5dc22a~mv2.jpg", "3bcff6_5e6bdadb1a264c0fa2076f17cd5dc22a_mv2.jpg", "blog/benefits-of-hiring-a-professional-video-team-for-your-solar-energy-business-in-phoenix/cover.jpg", "blog/benefits-of-hiring-a-professional-video-team-for-your-solar-energy-business-in-phoenix/rooftop-solar-panels.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_4a06b662ba7e42c69194b975d72d1764~mv2.jpg", "3bcff6_4a06b662ba7e42c69194b975d72d1764_mv2.jpg", "blog/benefits-of-online-advertisements-for-your-healthcare-business/cover.jpg", "blog/benefits-of-online-advertisements-for-your-healthcare-business/clinician-with-senior-patient.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_87d082dce11c46e6af9bc9a1608ed526~mv2.jpg", "3bcff6_87d082dce11c46e6af9bc9a1608ed526_mv2.jpg", "blog/commercial-photography-and-video-production-for-sports-and-media-in-phoenix-and-scottsdale/cover.jpg", "blog/commercial-photography-and-video-production-for-sports-and-media-in-phoenix-and-scottsdale/football-player-helmet-closeup.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_1b351586ce6f431c8ad46f59d0aba1de~mv2.jpg", "3bcff6_1b351586ce6f431c8ad46f59d0aba1de_mv2.jpg", "blog/commercial-photography-and-video-production-for-sports-and-media-in-phoenix-and-scottsdale/image-01.jpg", "blog/commercial-photography-and-video-production-for-sports-and-media-in-phoenix-and-scottsdale/football-in-gloved-hands.webp"],
  ["https://static.wixstatic.com/media/3bcff6_062d5f07c80a421b8487660c19197c56~mv2.jpg", "3bcff6_062d5f07c80a421b8487660c19197c56_mv2.jpg", "blog/commercial-photography-and-video-production-for-sports-and-media-in-phoenix-and-scottsdale/image-02.jpg", "blog/commercial-photography-and-video-production-for-sports-and-media-in-phoenix-and-scottsdale/basketball-player-on-court.webp"],
  ["https://static.wixstatic.com/media/3bcff6_f82085484f7e4b6fb17ad417c7209d39~mv2.jpg", "3bcff6_f82085484f7e4b6fb17ad417c7209d39_mv2.jpg", "blog/considerations-when-hiring-a-video-team-for-your-phoenix-law-offices/cover.jpg", "blog/considerations-when-hiring-a-video-team-for-your-phoenix-law-offices/lawyer-desk-scales-of-justice.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_bd449622d5424a419244bba6f658251e~mv2.jpg", "3bcff6_bd449622d5424a419244bba6f658251e_mv2.jpg", "blog/create-effective-social-media-advertisements-for-your-small-business/cover.jpg", "blog/create-effective-social-media-advertisements-for-your-small-business/social-media-interface-illustration.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_e469a4697a5047acaf1777eca0d99d9e~mv2.jpg", "3bcff6_e469a4697a5047acaf1777eca0d99d9e_mv2.jpg", "blog/create-tiktok-and-instagram-ads-for-your-law-office/cover.jpg", "blog/create-tiktok-and-instagram-ads-for-your-law-office/judge-gavel-and-law-book.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_126dcb6bd48a4d44a936d98be076ddf3~mv2.jpg", "3bcff6_126dcb6bd48a4d44a936d98be076ddf3_mv2.jpg", "blog/creating-a-compelling-marketing-strategy/cover.jpg", "blog/creating-a-compelling-marketing-strategy/marketing-strategy-sticky-notes.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_67c3da58d3bf423099e02619d37e2222~mv2.jpg", "3bcff6_67c3da58d3bf423099e02619d37e2222_mv2.jpg", "blog/creative-marketing-and-video-production-in-sedona/cover.jpg", "blog/creative-marketing-and-video-production-in-sedona/sedona-red-rocks-aerial.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_636d5cd515424de89b1b506b002b1d02~mv2.jpg", "3bcff6_636d5cd515424de89b1b506b002b1d02_mv2.jpg", "blog/equipment-doesn-t-make-the-production-but-it-can-set-it-apart/cover.jpg", "blog/equipment-doesn-t-make-the-production-but-it-can-set-it-apart/sony-fx9-cinema-camera.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_fad9ba17e76d468c99a9e2e70bfd0d15~mv2.jpg", "3bcff6_fad9ba17e76d468c99a9e2e70bfd0d15_mv2.jpg", "blog/exploring-the-different-types-of-video-commercials-to-market-your-business/cover.jpg", "blog/exploring-the-different-types-of-video-commercials-to-market-your-business/crew-on-photo-studio-set.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_52f3d9752cdd494d921459572467a861~mv2.jpeg", "3bcff6_52f3d9752cdd494d921459572467a861_mv2.jpeg", "blog/grow-your-dental-practice-with-video-production/cover.jpg", "blog/grow-your-dental-practice-with-video-production/dental-patient-smiling-in-chair.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_d6aa89dca9774db9acb6d8fa6d4c42f7~mv2.jpg", "3bcff6_d6aa89dca9774db9acb6d8fa6d4c42f7_mv2.jpg", "blog/harness-the-power-of-video-advertising-to-grow-your-financial-services-business/cover.jpg", "blog/harness-the-power-of-video-advertising-to-grow-your-financial-services-business/financial-advisors-reviewing-charts.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_f07eeceade784b11baaf3a459480ca9e~mv2.jpeg", "3bcff6_f07eeceade784b11baaf3a459480ca9e_mv2.jpeg", "blog/how-large-companies-can-leverage-ai-to-create-personalized-ad-campaigns-for-their-customers/cover.jpg", "blog/how-large-companies-can-leverage-ai-to-create-personalized-ad-campaigns-for-their-customers/ai-marketing-isometric-illustration.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_03e81b82996b4acbbe481e258c1cab8b~mv2.jpg", "3bcff6_03e81b82996b4acbbe481e258c1cab8b_mv2.jpg", "blog/how-to-create-user-generated-content-ugc-for-your-small-business/cover.jpg", "blog/how-to-create-user-generated-content-ugc-for-your-small-business/creator-filming-ugc-video.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_7457dd78651b41c99660dfc3997f6f04~mv2.png", "3bcff6_7457dd78651b41c99660dfc3997f6f04_mv2.png", "blog/how-to-measure-the-roi-of-video-production-for-your-business/cover.png", "blog/how-to-measure-the-roi-of-video-production-for-your-business/dollar-bill-and-cinema-camera.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_27c7bb69e27c4a8781956f34bc38117b~mv2.jpg", "3bcff6_27c7bb69e27c4a8781956f34bc38117b_mv2.jpg", "blog/how-to-measure-the-success-of-a-marketing-campaign/cover.jpg", "blog/how-to-measure-the-success-of-a-marketing-campaign/team-reviewing-campaign-data.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_a721cd0f0b284ce689b0ec50cf5d9004~mv2.jpeg", "3bcff6_a721cd0f0b284ce689b0ec50cf5d9004_mv2.jpeg", "blog/leveraging-video-production-for-your-next-event-in-phoenix/cover.jpg", "blog/leveraging-video-production-for-your-next-event-in-phoenix/phoenix-skyline-golden-haze.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_a4ebedf3cbf443dd945cdec8eb0f8d1c~mv2.jpeg", "3bcff6_a4ebedf3cbf443dd945cdec8eb0f8d1c_mv2.jpeg", "blog/no-ai-will-not-be-totally-replacing-humans-for-video-production/cover.jpg", "blog/no-ai-will-not-be-totally-replacing-humans-for-video-production/robots-on-film-set.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_f094a0a798ae438791ba9f0385c79df0~mv2.jpg", "3bcff6_f094a0a798ae438791ba9f0385c79df0_mv2.jpg", "blog/our-results-oriented-data-driven-creative-marketing-agency-opens-in-phoenix-az/cover.jpg", "blog/our-results-oriented-data-driven-creative-marketing-agency-opens-in-phoenix-az/creative-agency-office.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_eb56441c61d8417693b1d60da320a94a~mv2.jpg", "3bcff6_eb56441c61d8417693b1d60da320a94a_mv2.jpg", "blog/phoenix-s-first-ai-powered-marketing-agency/cover.jpg", "blog/phoenix-s-first-ai-powered-marketing-agency/robot-with-arizona-flag.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_ed0277d7788f440e8c7982dc3b5f894e~mv2.jpg", "3bcff6_ed0277d7788f440e8c7982dc3b5f894e_mv2.jpg", "blog/premium-video-services-for-local-businesses-in-phoenix/cover.jpg", "blog/premium-video-services-for-local-businesses-in-phoenix/phoenix-skyline-at-dusk.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_ace37c700bae41fbbcd9e2f66006d089~mv2.jpeg", "3bcff6_ace37c700bae41fbbcd9e2f66006d089_mv2.jpeg", "blog/promote-your-phoenix-based-medical-practice-with-video/cover.jpg", "blog/promote-your-phoenix-based-medical-practice-with-video/doctor-at-computer-desk.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_488e38e72ad44379b04d48614c31869b~mv2.jpg", "3bcff6_488e38e72ad44379b04d48614c31869b_mv2.jpg", "blog/social-media-management-agency-smma-for-your-scottsdale-business/cover.jpg", "blog/social-media-management-agency-smma-for-your-scottsdale-business/influencer-filming-on-phone.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_9183a0a3dc4d46fc9659312c063e06b5~mv2.jpg", "3bcff6_9183a0a3dc4d46fc9659312c063e06b5_mv2.jpg", "blog/the-art-of-creating-a-powerful-marketing-campaign/cover.jpg", "blog/the-art-of-creating-a-powerful-marketing-campaign/marketer-planning-on-corkboard.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_5586f5c82cc54347b14094aa5e60ddd5~mv2.jpg", "3bcff6_5586f5c82cc54347b14094aa5e60ddd5_mv2.jpg", "blog/the-best-video-production-advertising-for-law-offices-in-scottsdale-arizona/cover.jpg", "blog/the-best-video-production-advertising-for-law-offices-in-scottsdale-arizona/arizona-desert-mountains-sunset.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_eb53f98df16c42e58008e99d1325c9ac~mv2.jpg", "3bcff6_eb53f98df16c42e58008e99d1325c9ac_mv2.jpg", "blog/the-difference-and-benefits-of-8-bit-video-vs-10-bit-video/cover.jpg", "blog/the-difference-and-benefits-of-8-bit-video-vs-10-bit-video/a7rii-vs-fs7-color-comparison.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_fa32397cd7c948a1933187682ac7ac9f~mv2.jpg", "3bcff6_fa32397cd7c948a1933187682ac7ac9f_mv2.jpg", "blog/the-difference-and-benefits-of-8-bit-video-vs-10-bit-video/image-01.jpg", "blog/the-difference-and-benefits-of-8-bit-video-vs-10-bit-video/8-bit-vs-10-bit-color-chart.webp"],
  ["https://static.wixstatic.com/media/3bcff6_d907d4f9337145da9797b4a8c6fa276f~mv2.jpeg", "3bcff6_d907d4f9337145da9797b4a8c6fa276f_mv2.jpeg", "blog/the-difference-between-an-ad-agency-and-a-creative-agency/cover.jpg", "blog/the-difference-between-an-ad-agency-and-a-creative-agency/colored-trash-bins-lineup.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_85a1c8111126442baed526ea232c1dec~mv2.jpeg", "3bcff6_85a1c8111126442baed526ea232c1dec_mv2.jpeg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/cover.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/arizona-movie-theater-marquee.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_861598f2f50b4dfcbf0aa0a6d654365e~mv2.jpg", "3bcff6_861598f2f50b4dfcbf0aa0a6d654365e_mv2.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/image-01.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/stagecoach-1939-poster.webp"],
  ["https://static.wixstatic.com/media/3bcff6_026aca97b86847d4b384acbc9e578506~mv2.jpg", "3bcff6_026aca97b86847d4b384acbc9e578506_mv2.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/image-02.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/classic-western-film-still.webp"],
  ["https://static.wixstatic.com/media/3bcff6_c859d94393cd4751a59c57af3b062c33~mv2.webp", "3bcff6_c859d94393cd4751a59c57af3b062c33_mv2.webp", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/image-03.webp", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/the-thing-1951-poster.webp"],
  ["https://static.wixstatic.com/media/3bcff6_f3eb145baad94d6696a07abc1e7ccf7f~mv2.jpg", "3bcff6_f3eb145baad94d6696a07abc1e7ccf7f_mv2.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/image-04.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/easy-rider-1969-poster.webp"],
  ["https://static.wixstatic.com/media/3bcff6_5b3007e212d84b3db1a713c52ec3ce0e~mv2.jpg", "3bcff6_5b3007e212d84b3db1a713c52ec3ce0e_mv2.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/image-05.jpg", "blog/the-history-of-cinema-in-the-state-of-arizona-and-the-future/transformers-revenge-of-the-fallen-poster.webp"],
  ["https://static.wixstatic.com/media/3bcff6_a8b0aa84511d4293a7f2725b25729f5c~mv2.jpg", "3bcff6_a8b0aa84511d4293a7f2725b25729f5c_mv2.jpg", "blog/the-importance-of-and-data-behind-advertising-on-social-media/cover.jpg", "blog/the-importance-of-and-data-behind-advertising-on-social-media/social-media-marketing-flatlay.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_dd41c5aa3ab944888652a1619522ea49~mv2.jpg", "3bcff6_dd41c5aa3ab944888652a1619522ea49_mv2.jpg", "blog/the-importance-of-using-brand-guidelines/cover.jpg", "blog/the-importance-of-using-brand-guidelines/brand-trust-design-letter-blocks.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_23c6c0fc465349ccad50a7bb378c264d~mv2.jpg", "3bcff6_23c6c0fc465349ccad50a7bb378c264d_mv2.jpg", "blog/the-power-of-video-interviews-to-promote-your-business/cover.jpg", "blog/the-power-of-video-interviews-to-promote-your-business/video-interview-behind-the-scenes.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_4967cb3b9107492a83df1db9f2ad0c5b~mv2.jpg", "3bcff6_4967cb3b9107492a83df1db9f2ad0c5b_mv2.jpg", "blog/understanding-your-target-audience-main-segments-and-how-to-approach-them/cover.jpg", "blog/understanding-your-target-audience-main-segments-and-how-to-approach-them/market-segmentation-charts.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_4e4cf203a2cb44e7860b1a493afb8f7b~mv2.jpg", "3bcff6_4e4cf203a2cb44e7860b1a493afb8f7b_mv2.jpg", "blog/use-social-media-to-boost-your-advertising-roi-for-your-phoenix-based-dental-practice/cover.jpg", "blog/use-social-media-to-boost-your-advertising-roi-for-your-phoenix-based-dental-practice/woman-scrolling-phone-on-couch.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_29b280e963d64ab1a3c866606f18aa5c~mv2.jpeg", "3bcff6_29b280e963d64ab1a3c866606f18aa5c_mv2.jpeg", "blog/use-the-power-of-video-to-advertise-your-next-event-in-phoenix/cover.jpg", "blog/use-the-power-of-video-to-advertise-your-next-event-in-phoenix/videographer-filming-conference.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_71d1e612c0614484b0e8e642eee43b7f~mv2.jpg", "3bcff6_71d1e612c0614484b0e8e642eee43b7f_mv2.jpg", "blog/use-video-to-boost-marketing-roi-for-phoenix-small-businesses/cover.jpg", "blog/use-video-to-boost-marketing-roi-for-phoenix-small-businesses/editor-cutting-interview-video.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_132c6cc89ff44f96a555ddcbb92123c4~mv2.jpeg", "3bcff6_132c6cc89ff44f96a555ddcbb92123c4_mv2.jpeg", "blog/using-ai-for-your-content-creation-is-more-difficult-than-you-might-think/cover.jpg", "blog/using-ai-for-your-content-creation-is-more-difficult-than-you-might-think/frustrated-man-at-computer.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_188fbed8ce1e43c7bd443ddd4b9d1d50~mv2.jpg", "3bcff6_188fbed8ce1e43c7bd443ddd4b9d1d50_mv2.jpg", "blog/video-production-and-commercial-photography-services-for-financial-services-companies-in-phoenix-and/cover.jpg", "blog/video-production-and-commercial-photography-services-for-financial-services-companies-in-phoenix-and/businessman-in-modern-office.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_1c94989502364ea9bba3f8325d3f1cfa~mv2.jpg", "3bcff6_1c94989502364ea9bba3f8325d3f1cfa_mv2.jpg", "blog/video-production-and-creative-marketing-agency-in-tucson/cover.jpg", "blog/video-production-and-creative-marketing-agency-in-tucson/tucson-skyline-at-sunset.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_f76a2a0a295c4bcab818248997bf8f48~mv2.jpg", "3bcff6_f76a2a0a295c4bcab818248997bf8f48_mv2.jpg", "blog/video-production-in-flagstaff-that-stands-out/cover.jpg", "blog/video-production-in-flagstaff-that-stands-out/flagstaff-san-francisco-peaks.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_2186df6144064c7da9eb67c3e042fc7f~mv2.jpg", "3bcff6_2186df6144064c7da9eb67c3e042fc7f_mv2.jpg", "blog/video-production-services-for-phoenix-s-metropolitan-area/cover.jpg", "blog/video-production-services-for-phoenix-s-metropolitan-area/crew-filming-kitchen-set.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_476ffa2070b5462aa6f127623f86d384~mv2.jpg", "3bcff6_476ffa2070b5462aa6f127623f86d384_mv2.jpg", "blog/video-production-services-for-phoenix-s-metropolitan-area/image-01.jpg", "blog/video-production-services-for-phoenix-s-metropolitan-area/crew-on-set-with-clapperboard.webp"],
  ["https://static.wixstatic.com/media/3bcff6_6f7878e218694eea8c9a8d4af54d0c5a~mv2.jpg", "3bcff6_6f7878e218694eea8c9a8d4af54d0c5a_mv2.jpg", "blog/video-production-services-for-phoenix-s-metropolitan-area/image-02.jpg", "blog/video-production-services-for-phoenix-s-metropolitan-area/crew-lighting-living-room-set.webp"],
  ["https://static.wixstatic.com/media/3bcff6_a7e0c3d2d2ba4310a8d339bd0aef03b9~mv2.jpg", "3bcff6_a7e0c3d2d2ba4310a8d339bd0aef03b9_mv2.jpg", "blog/video-s-impact-on-marketing-is-more-important-than-ever-in-2023/cover.jpg", "blog/video-s-impact-on-marketing-is-more-important-than-ever-in-2023/marketing-strategy-flatlay.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_303a0426f16c42bc8911282d4db62135~mv2.jpg", "3bcff6_303a0426f16c42bc8911282d4db62135_mv2.jpg", "blog/what-to-consider-when-hiring-a-video-production-crew-in-phoenix/cover.jpg", "blog/what-to-consider-when-hiring-a-video-production-crew-in-phoenix/crew-filming-outdoor-shoot.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_bffda8d7d7e442a8b8bd9d38c3a12710~mv2.jpeg", "3bcff6_bffda8d7d7e442a8b8bd9d38c3a12710_mv2.jpeg", "blog/why-aerospace-and-defense-companies-need-to-leverage-video-to-convey-complex-topics/cover.jpg", "blog/why-aerospace-and-defense-companies-need-to-leverage-video-to-convey-complex-topics/fighter-jet-illustration.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_20ed9c0b91534af59a6ffda18ed2b3ba~mv2.jpg", "3bcff6_20ed9c0b91534af59a6ffda18ed2b3ba_mv2.jpg", "blog/why-ai-s-the-future-of-creative-marketing/cover.jpg", "blog/why-ai-s-the-future-of-creative-marketing/ai-circuit-brain-illustration.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_735695eb38df47eb8d4fe17770819ca6~mv2.jpeg", "3bcff6_735695eb38df47eb8d4fe17770819ca6_mv2.jpeg", "blog/why-augmented-reality-has-not-caught-on-yet/cover.jpg", "blog/why-augmented-reality-has-not-caught-on-yet/person-in-vr-headset.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_168b794b1b394d4e90ab04d646f6eb53~mv2.jpg", "3bcff6_168b794b1b394d4e90ab04d646f6eb53_mv2.jpg", "blog/why-chiropractors-should-leverage-video-to-advertise-online/cover.jpg", "blog/why-chiropractors-should-leverage-video-to-advertise-online/chiropractor-adjusting-patient.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_9d449430c7634ed8b3d67142cc53523a~mv2.jpg", "3bcff6_9d449430c7634ed8b3d67142cc53523a_mv2.jpg", "blog/why-hire-a-video-crew-to-capture-your-next-big-phoenix-based-event/cover.jpg", "blog/why-hire-a-video-crew-to-capture-your-next-big-phoenix-based-event/videographer-filming-concert.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_76c4beba16bf42af98a0ffce94619066~mv2.jpg", "3bcff6_76c4beba16bf42af98a0ffce94619066_mv2.jpg", "blog/why-hire-an-editor-to-make-ads-for-tiktok-and-instagram/cover.jpg", "blog/why-hire-an-editor-to-make-ads-for-tiktok-and-instagram/social-media-scrabble-tiles.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_4f4a76bdc1a64fee8a3f0f796d7e527e~mv2.jpeg", "3bcff6_4f4a76bdc1a64fee8a3f0f796d7e527e_mv2.jpeg", "blog/why-more-dentists-are-harnessing-the-power-of-video-to-advertise/cover.jpg", "blog/why-more-dentists-are-harnessing-the-power-of-video-to-advertise/dentist-treating-patient.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_2f9d124bf5054ae3a56ff79e4fff2325~mv2.jpeg", "3bcff6_2f9d124bf5054ae3a56ff79e4fff2325_mv2.jpeg", "blog/why-phoenix-az-has-a-quickly-growing-film-video-production-community/cover.jpg", "blog/why-phoenix-az-has-a-quickly-growing-film-video-production-community/camera-overlooking-phoenix-at-dusk.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_b736062ed23645e4a2a77c3b1cc2c5ca~mv2.jpg", "3bcff6_b736062ed23645e4a2a77c3b1cc2c5ca_mv2.jpg", "blog/why-phoenix-based-physical-therapists-are-filming-more-video-content/cover.jpg", "blog/why-phoenix-based-physical-therapists-are-filming-more-video-content/physical-therapist-senior-exercise.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_3df99b80d8924450a68aac2cad84cab8~mv2.png", "3bcff6_3df99b80d8924450a68aac2cad84cab8_mv2.png", "blog/why-video-production-for-marketing-campaigns-are-so-expensive/cover.png", "blog/why-video-production-for-marketing-campaigns-are-so-expensive/dollar-bill-and-cinema-camera.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_b793e7572fce49a59cd7ab9bbe631f56~mv2.webp", "3bcff6_b793e7572fce49a59cd7ab9bbe631f56_mv2.webp", "blog/why-we-use-sony-s-fx-cinema-line-cameras/cover.webp", "blog/why-we-use-sony-s-fx-cinema-line-cameras/sony-cinema-line-cameras.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_5ceac43fc991412eb2d259d422b106fa~mv2.jpg", "3bcff6_5ceac43fc991412eb2d259d422b106fa_mv2.jpg", "blog/why-we-ve-launched-a-creative-marketing-agency-in-2023/cover.jpg", "blog/why-we-ve-launched-a-creative-marketing-agency-in-2023/thrill-wave-crew-with-van.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_a5dca1a4abb043bc861b2a614d748c3a~mv2.jpg", "3bcff6_a5dca1a4abb043bc861b2a614d748c3a_mv2.jpg", "blog/why-we-ve-launched-a-creative-marketing-agency-in-2023/image-01.jpg", "blog/why-we-ve-launched-a-creative-marketing-agency-in-2023/excited-videographer-meme.webp"],
  ["https://static.wixstatic.com/media/3bcff6_30343c4c8d4d4f46a2a1736e65d4f4b7~mv2.jpg", "3bcff6_30343c4c8d4d4f46a2a1736e65d4f4b7_mv2.jpg", "blog/why-we-ve-launched-a-creative-marketing-agency-in-2023/image-02.jpg", "blog/why-we-ve-launched-a-creative-marketing-agency-in-2023/ancient-aliens-precision-meme.webp"],
  ["https://static.wixstatic.com/media/3bcff6_cd7e4f0c7cca4c7daf96cbf36b9f19db~mv2.jpeg", "3bcff6_cd7e4f0c7cca4c7daf96cbf36b9f19db_mv2.jpeg", "blog/why-you-need-documentary-style-testimonials-for-your-business/cover.jpg", "blog/why-you-need-documentary-style-testimonials-for-your-business/documentary-interview-lighting-setup.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_016cb3804b1f4f2084aad314a9090f2e~mv2.jpeg", "3bcff6_016cb3804b1f4f2084aad314a9090f2e_mv2.jpeg", "blog/why-your-ai-generated-content-isn-t-very-good/cover.jpg", "blog/why-your-ai-generated-content-isn-t-very-good/colored-trash-bins-lineup.jpg"],
  ["https://static.wixstatic.com/media/3bcff6_a0ee651a8cae44cc9962a1136a6d052c~mv2.png", "3bcff6_a0ee651a8cae44cc9962a1136a6d052c_mv2.png", "brand/thrill-wave-logo.png", "brand/thrill-wave-logo.png"],
  ["https://static.wixstatic.com/media/3bcff6_22020618230b42d8a3a8d692d3fb1a6d~mv2.jpg", "3bcff6_22020618230b42d8a3a8d692d3fb1a6d_mv2.jpg", "brand/thrill-wave-social-share.jpg", "brand/thrill-wave-social-share.jpg"],
  ["https://static.wixstatic.com/media/f05f08_1a851a50e014452f88d5a63b39b199ed~mv2.png", "f05f08_1a851a50e014452f88d5a63b39b199ed_mv2.png", "clients/1st-bank.png", "clients/1st-bank.webp"],
  ["https://static.wixstatic.com/media/f05f08_6f51952deec6419aad4cf758de37632a~mv2.png", "f05f08_6f51952deec6419aad4cf758de37632a_mv2.png", "clients/aura.png", "clients/aura.webp"],
  ["https://static.wixstatic.com/media/3bcff6_2be4a23e224d4070bc1ba763df39382f~mv2.png", "3bcff6_2be4a23e224d4070bc1ba763df39382f_mv2.png", "clients/boston-scientific.png", "clients/boston-scientific.webp"],
  ["https://static.wixstatic.com/media/f05f08_ac8c475177304d9f81f3c7fd54c3626a~mv2.png", "f05f08_ac8c475177304d9f81f3c7fd54c3626a_mv2.png", "clients/client-logo-01.png", "clients/relentless-beats.webp"],
  ["https://static.wixstatic.com/media/3bcff6_264bb096231e4ce6bf5dbfd16ce7a5ba~mv2.png", "3bcff6_264bb096231e4ce6bf5dbfd16ce7a5ba_mv2.png", "clients/client-logo-02.png", "clients/ufc.webp"],
  ["https://static.wixstatic.com/media/3bcff6_e6a5f3eed8834d2f87d05685d0921547~mv2.png", "3bcff6_e6a5f3eed8834d2f87d05685d0921547_mv2.png", "clients/client-logo-03.png", "clients/thermo-fisher-scientific.webp"],
  ["https://static.wixstatic.com/media/f05f08_a13ce61e7f524f1289f116987b981cbc~mv2.png", "f05f08_a13ce61e7f524f1289f116987b981cbc_mv2.png", "clients/client-logo-04.png", "clients/uber.webp"],
  ["https://static.wixstatic.com/media/3bcff6_ba1461d286304208a9f077784d089b42~mv2.png", "3bcff6_ba1461d286304208a9f077784d089b42_mv2.png", "clients/client-logo-05.png", "clients/nbc.webp"],
  ["https://static.wixstatic.com/media/3bcff6_2aad81e667154bd7bcf7168fe4eccf63~mv2.png", "3bcff6_2aad81e667154bd7bcf7168fe4eccf63_mv2.png", "clients/client-logo-06.png", "clients/golf-digest.webp"],
  ["https://static.wixstatic.com/media/3bcff6_7cbac2d32f40459191dcb54a4f7a4492~mv2.png", "3bcff6_7cbac2d32f40459191dcb54a4f7a4492_mv2.png", "clients/client-logo-07.png", "clients/pathnostics.webp"],
  ["https://static.wixstatic.com/media/f05f08_a666b00f2a2e4985b17a9fe7b7f2e5b1~mv2.png", "f05f08_a666b00f2a2e4985b17a9fe7b7f2e5b1_mv2.png", "clients/nfl.png", "clients/nfl.webp"],
  ["https://static.wixstatic.com/media/f05f08_563f8a77b40547cc82d1dde392b528cf~mv2.png", "f05f08_563f8a77b40547cc82d1dde392b528cf_mv2.png", "clients/state-farm.png", "clients/state-farm.webp"],
  ["https://static.wixstatic.com/media/f05f08_56d61e91c5d24a10800600354ccd0916~mv2.png", "f05f08_56d61e91c5d24a10800600354ccd0916_mv2.png", "clients/ubs.png", "clients/ubs.webp"],
  ["https://static.wixstatic.com/media/11062b_23038e254b914d11b792ca46e48b637f~mv2_d_5000_3333_s_4_2.jpg", "11062b_23038e254b914d11b792ca46e48b637f_mv2_d_5000_3333_s_4_2.jpg", "marketing-challenges/wix-stock-businesswomen.jpg", "marketing-challenges/wix-stock-businesswomen-at-laptop.webp"],
  ["https://static.wixstatic.com/media/11062b_d455eec9c54b4989becd41afa405c1bc~mv2.jpg", "11062b_d455eec9c54b4989becd41afa405c1bc_mv2.jpg", "marketing-challenges/wix-stock-woman-reviewing-charts.jpg", "marketing-challenges/wix-stock-woman-reviewing-charts.webp"],
  ["https://static.wixstatic.com/media/f05f08_5cdc98efadc047068a3d00a1b089a293~mv2.jpg", "f05f08_5cdc98efadc047068a3d00a1b089a293_mv2.jpg", "medical/photography-01.jpg", "medical/doctor-explaining-scan-to-patient.webp"],
  ["https://static.wixstatic.com/media/3bcff6_fc6f3b54e22542a693887fc4c09b7aa0~mv2.jpg", "3bcff6_fc6f3b54e22542a693887fc4c09b7aa0_mv2.jpg", "medical/photography-02.jpg", "medical/doctor-smiling-with-patient.webp"],
  ["https://static.wixstatic.com/media/3bcff6_464a8ec81ec043848646efc636b7ccd9~mv2.jpg", "3bcff6_464a8ec81ec043848646efc636b7ccd9_mv2.jpg", "medical/photography-03.jpg", "medical/clinicians-reviewing-tablet.webp"],
  ["https://static.wixstatic.com/media/3bcff6_10e937f93d894723847a573d06e11fef~mv2.jpg", "3bcff6_10e937f93d894723847a573d06e11fef_mv2.jpg", "medical/photography-04.jpg", "medical/pharmacist-consultation.webp"],
  ["https://static.wixstatic.com/media/3bcff6_e73af2998c3340f280d68414b9c20bc9~mv2.png", "3bcff6_e73af2998c3340f280d68414b9c20bc9_mv2.png", "medical/photography-05.png", "medical/clinician-portrait-with-tablet.webp"],
  ["https://static.wixstatic.com/media/3bcff6_597a5a3b6bee459080dd6296d0ed3833~mv2.jpg", "3bcff6_597a5a3b6bee459080dd6296d0ed3833_mv2.jpg", "medical/photography-06.jpg", "medical/patient-entering-clinic.webp"],
  ["https://static.wixstatic.com/media/3bcff6_1bbdbacf138a443eaeb50dd2446f3d4c~mv2.jpg", "3bcff6_1bbdbacf138a443eaeb50dd2446f3d4c_mv2.jpg", "medical/photography-07.jpg", "medical/doctor-headshot-white-coat.webp"],
  ["https://static.wixstatic.com/media/3bcff6_1e9648d8291342439aeda64298b9943f~mv2.jpg", "3bcff6_1e9648d8291342439aeda64298b9943f_mv2.jpg", "medical/photography-08.jpg", "medical/dentist-using-surgical-microscope.webp"],
  ["https://static.wixstatic.com/media/3bcff6_139434df777d44ae9b2b0f26aca5adc9~mv2.jpg", "3bcff6_139434df777d44ae9b2b0f26aca5adc9_mv2.jpg", "medical/photography-09.jpg", "medical/pharmacist-headshot.webp"],
  ["https://static.wixstatic.com/media/3bcff6_b45045a8e3324a8186c76b8795910cd3~mv2.jpg", "3bcff6_b45045a8e3324a8186c76b8795910cd3_mv2.jpg", "medical/photography-10.jpg", "medical/doctor-explaining-scan-wide.webp"],
  ["https://static.wixstatic.com/media/3bcff6_e6316d0f9d894d8eb17631f7b6dd5cb4~mv2.jpg", "3bcff6_e6316d0f9d894d8eb17631f7b6dd5cb4_mv2.jpg", "medical/photography-11.jpg", "medical/dental-procedure-closeup.webp"],
  ["https://static.wixstatic.com/media/3bcff6_af8b97a893b24e20bbd5ff1ba70456fa~mv2.jpg", "3bcff6_af8b97a893b24e20bbd5ff1ba70456fa_mv2.jpg", "medical/photography-12.jpg", "medical/clinic-exterior-at-dusk.webp"],
  ["https://static.wixstatic.com/media/3bcff6_a35d15a52f8d4c4ca938cc4bc0cd6972~mv2.jpg", "3bcff6_a35d15a52f8d4c4ca938cc4bc0cd6972_mv2.jpg", "medical/video-thumbnail-01.jpg", "medical/video-thumb-pathnostics-interview.webp"],
  ["https://static.wixstatic.com/media/3bcff6_5fa7d4c522b94776ae6308dcfc07791c~mv2.jpg", "3bcff6_5fa7d4c522b94776ae6308dcfc07791c_mv2.jpg", "medical/video-thumbnail-02.jpg", "medical/video-thumb-plastic-surgeon-interview.webp"],
  ["https://static.wixstatic.com/media/3bcff6_916fa784117e401bbd7d70f38c420c6d~mv2.jpg", "3bcff6_916fa784117e401bbd7d70f38c420c6d_mv2.jpg", "medical/video-thumbnail-03.jpg", "medical/video-thumb-patient-couple-outdoors.webp"],
  ["https://static.wixstatic.com/media/3bcff6_daf6c024c17f4437b7e70a87f3ed71b3~mv2.jpg", "3bcff6_daf6c024c17f4437b7e70a87f3ed71b3_mv2.jpg", "medical/video-thumbnail-04.jpg", "medical/video-thumb-patient-stretching.webp"],
  ["https://static.wixstatic.com/media/f05f08_df0661ca9d844268b6f267eddf606da1~mv2.jpg", "f05f08_df0661ca9d844268b6f267eddf606da1_mv2.jpg", "medical/why-choose-us.jpg", "medical/dentist-at-microscope.webp"],
  ["https://static.wixstatic.com/media/f05f08_d0241eb2a21d4bc1bfddecde007e9259~mv2.jpg", "f05f08_d0241eb2a21d4bc1bfddecde007e9259_mv2.jpg", "medical/your-vision.jpg", "medical/dentist-chairside-with-patient.webp"],
  ["https://static.wixstatic.com/media/784594_d144013a53ef42fdb99b6ff05b1dca09~mv2.jpg", "784594_d144013a53ef42fdb99b6ff05b1dca09_mv2.jpg", "process/hero-film-set.jpg", "process/crew-rigging-cinema-camera.webp"],
  ["https://static.wixstatic.com/media/3bcff6_79cf685905d54eefb04c2f2002af3609f000.jpg", "3bcff6_79cf685905d54eefb04c2f2002af3609f000.jpg", "shared/hero-camera-operator.jpg", "shared/hero-on-set-monitor-view.webp"],
  ["https://static.wixstatic.com/media/f05f08_1654d440be9e426ab2dae206b4a35cc6f000.jpg", "f05f08_1654d440be9e426ab2dae206b4a35cc6f000.jpg", "shared/hero-medical-practice.jpg", null],
  ["https://static.wixstatic.com/media/784594_3406ba2c40034e6ba6716129610d3168~mv2.jpg", "784594_3406ba2c40034e6ba6716129610d3168_mv2.jpg", "team/ari-everett.jpg", "team/ari-everett.webp"],
  ["https://static.wixstatic.com/media/784594_5585ac307e434cc3b24211735cf0fc9b~mv2.jpg", "784594_5585ac307e434cc3b24211735cf0fc9b_mv2.jpg", "team/chris-kuzman.jpg", "team/chris-kuzman.webp"],
  ["https://static.wixstatic.com/media/784594_727aef845b2b4f1aaee5b43d30c9304b~mv2.jpg", "784594_727aef845b2b4f1aaee5b43d30c9304b_mv2.jpg", "team/tony-swann.jpg", "team/tony-swann.webp"]
];

const HERO_REPLACEMENT = {
  'medical.html': '/images/medical/doctor-explaining-scan-to-patient.webp',
  'marketingchallenges.html': '/images/shared/hero-on-set-monitor-view.webp',
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(html|md|json)$/.test(e.name) ? [p] : [];
  });
}

let changed = 0;
const missing = new Set();
for (const file of ['src', 'content'].flatMap((d) => walk(path.join(ROOT, d)))) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  for (const [url, wixName, organized, next] of MAP) {
    const olds = [url, `/images/wix/${wixName}`, `/images/${organized}`];
    const target = next ? `/images/${next}` : HERO_REPLACEMENT[path.basename(file)];
    for (const old of olds) {
      if (!s.includes(old)) continue;
      if (!target) { missing.add(`${old} in ${path.relative(ROOT, file)}`); continue; }
      s = s.split(old).join(target);
    }
  }
  if (s !== before) { fs.writeFileSync(file, s); changed++; }
}

// Client logos are light gray (made for a dark background): render them dark instead.
const cssPath = path.join(ROOT, 'public/css/site.css');
let css = fs.readFileSync(cssPath, 'utf8');
if (css.includes('filter: grayscale(1); opacity: .85;')) {
  css = css.replace('filter: grayscale(1); opacity: .85;', 'filter: brightness(0); opacity: .7;');
  console.log('Updated client logo styling in public/css/site.css');
}
// Header logo is now tightly cropped: size it by height so it fits the header bar.
css = css.replace('.logo img { width: 150px; height: auto; }', '.logo img { height: 48px; width: auto; }');
fs.writeFileSync(cssPath, css);

// Sanity check: every referenced image exists
const refs = new Set();
for (const file of ['src', 'content'].flatMap((d) => walk(path.join(ROOT, d))))
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/\/images\/[\w./-]+\.(?:jpg|png|webp)/g)) refs.add(m[0]);
const broken = [...refs].filter((r) => !fs.existsSync(path.join(ROOT, 'public', r)));

console.log(`Updated image references in ${changed} files.`);
if (missing.size) console.log('Could not map:\n  ' + [...missing].join('\n  '));
console.log(broken.length ? `Missing image files:\n  ${broken.join('\n  ')}` : 'All referenced images found.');
