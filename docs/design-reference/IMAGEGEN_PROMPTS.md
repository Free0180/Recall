# ImageGen 视觉概念提示词

## 生成模式

两张图片均为从零生成的界面概念稿，不含参考图片输入。

## 平板界面最终提示词

```text
Use case: ui-mockup
Asset type: production design concept for a responsive PET English vocabulary PWA
Primary request: Create one complete high-fidelity tablet home/study screen for a Chinese child preparing for Cambridge B1 Preliminary for Schools. This will be the exact visual reference for a React implementation.
Scene/backdrop: Full 11.5-inch tablet landscape app viewport, no device frame, true white background with very subtle cool blue-gray sections.
Style/medium: Clean airy modern educational product UI, friendly but not childish, restrained editorial illustration details only, professional and code-implementable.
Composition/framing: 1440x900 landscape. Simple top header, spacious two-column main area, fixed bottom navigation. Left two-thirds contains today's active word card; right third contains today's plan and review progress. Show the entire app viewport with no cropping.
Text (verbatim): App title "PET词汇精读"; header greeting "早上好，今天继续进步"; progress "今日 3 / 10"; main word "ability"; IPA "/əˈbɪləti/"; Chinese meaning "n. 能力；才能"; phonics heading "自然拼读"; phonics content "a · bil · i · ty"; stress note "重音在第二音节"; example heading "例句"; example "She has the ability to learn quickly."; translation "她有快速学习的能力。"; buttons "不认识", "有点熟", "认识"; right heading "今日计划"; items "新学 10词", "复习 8词", "精读 10分钟"; stats heading "本周进度"; stats "连续学习 4天"; bottom navigation labels "学习", "词库", "精读", "错词", "我的".
Color palette: True white, deep navy text, clear Cambridge-like blue as primary accent, fresh mint green for success, small warm coral highlights. No gradients.
Typography: Large highly readable Chinese and English sans serif. Strong hierarchy; controls have deliberate typography.
Components: Generous rounded corners, very light borders, subtle shadows only on the active word surface, circular blue speaker button next to the word, thin progress bar, simple outline icons matching one family.
Constraints: All visible UI text must be code-native in implementation; concept is visual spec only. Large touch targets, accessible contrast, tablet-first but responsive. Avoid card grid clutter, nested cards, decorative pills, excessive badges, fake analytics, mascot characters, photographic imagery, glassmorphism, gradients, neon, and tiny text. No browser chrome, no device frame, no watermark.
```

## 手机界面最终提示词

```text
Use case: ui-mockup
Asset type: coordinated responsive mobile study-state concept for the same "PET词汇精读" PWA design system
Primary request: Create one complete high-fidelity iPhone portrait study screen that is the responsive counterpart of the previously generated tablet concept. Preserve the same true-white, Cambridge-blue, mint-green, warm-coral visual system, typography character, light borders, icon family, and generous touch targets.
Composition/framing: 430x932 portrait app viewport, no device frame, show complete screen without cropping. Compact top header, scrollable active word content, fixed bottom navigation. Keep one open main learning surface rather than nested card grids.
Text (verbatim): Header "PET词汇精读"; progress "3 / 10"; word "ability"; IPA "/əˈbɪləti/"; meaning "n. 能力；才能"; heading "自然拼读"; content "a · bil · i · ty"; note "重音在第二音节"; heading "例句"; sentence "She has the ability to learn quickly."; translation "她有快速学习的能力。"; buttons "不认识", "有点熟", "认识"; bottom labels "学习", "词库", "精读", "错词", "我的".
Controls: Back chevron at top left, circular blue speaker button beside the word, thin progress indicator, three large rating buttons that fit without clipping, simple outline bottom-nav icons.
Constraints: Large accessible Chinese text, high contrast, safe-area spacing, no tiny text, no badges/pills, no decorative hero copy, no gradients, no mascot, no photographs, no glassmorphism, no device chrome, no watermark. All UI should be practical to implement in React/CSS.
```
