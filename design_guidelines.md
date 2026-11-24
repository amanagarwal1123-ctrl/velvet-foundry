{
  "app": {
    "name": "Factory App — Silver & Gold Casting Workshop Manager",
    "design_personality": {
      "keywords": [
        "calm",
        "trustworthy",
        "photo-led",
        "high-clarity",
        "tablet-friendly",
        "bilingual-first (Hindi/English)",
        "industrial-professional (not flashy)"
      ],
      "north_star": "Every screen is a photo-first checklist: staff can confirm the right bag/packet visually, then tap one big action to record weights/movements with minimal reading.",
      "anti_goals": [
        "No dense text walls",
        "No tiny table-only screens",
        "No purple gradients / neon cyber look",
        "No cramped spacing",
        "No decorative stock photos (all photos are user-uploaded)"
      ]
    }
  },

  "design_tokens": {
    "notes": [
      "Palette is mandatory: Velvet-Blue + Silver + Cloud-Blue.",
      "Use HSL tokens to align with shadcn variable format in index.css.",
      "Avoid large gradients; if used, keep to hero/header only and <20% viewport."
    ],

    "core_palette_hsl": {
      "velvet_blue": {
        "900": "222 58% 14%",
        "800": "222 52% 18%",
        "700": "221 46% 24%",
        "600": "221 44% 32%",
        "500": "221 55% 44%",
        "400": "221 70% 58%"
      },
      "cloud_blue": {
        "100": "214 45% 96%",
        "200": "214 38% 92%",
        "300": "214 30% 86%",
        "400": "214 24% 78%"
      },
      "silver": {
        "100": "220 18% 96%",
        "200": "220 14% 90%",
        "300": "220 10% 82%",
        "400": "220 8% 72%",
        "500": "220 7% 62%"
      },
      "status": {
        "success": "152 45% 34%",
        "warning": "38 92% 50%",
        "danger": "0 72% 52%",
        "info": "206 70% 44%"
      }
    },

    "shadcn_semantic_tokens_light": {
      "background": "214 45% 96%",
      "foreground": "222 58% 14%",
      "card": "0 0% 100%",
      "card-foreground": "222 58% 14%",
      "popover": "0 0% 100%",
      "popover-foreground": "222 58% 14%",

      "primary": "221 55% 44%",
      "primary-foreground": "0 0% 100%",

      "secondary": "214 38% 92%",
      "secondary-foreground": "222 58% 14%",

      "muted": "220 18% 96%",
      "muted-foreground": "221 18% 38%",

      "accent": "214 30% 86%",
      "accent-foreground": "222 58% 14%",

      "destructive": "0 72% 52%",
      "destructive-foreground": "0 0% 100%",

      "border": "220 14% 90%",
      "input": "220 14% 90%",
      "ring": "221 55% 44%",

      "radius": "0.9rem"
    },

    "shadcn_semantic_tokens_dark": {
      "background": "222 58% 10%",
      "foreground": "214 45% 96%",
      "card": "222 52% 14%",
      "card-foreground": "214 45% 96%",
      "popover": "222 52% 14%",
      "popover-foreground": "214 45% 96%",

      "primary": "221 70% 58%",
      "primary-foreground": "222 58% 10%",

      "secondary": "221 46% 24%",
      "secondary-foreground": "214 45% 96%",

      "muted": "221 46% 24%",
      "muted-foreground": "214 18% 78%",

      "accent": "221 44% 32%",
      "accent-foreground": "214 45% 96%",

      "destructive": "0 62% 42%",
      "destructive-foreground": "214 45% 96%",

      "border": "221 46% 24%",
      "input": "221 46% 24%",
      "ring": "221 70% 58%",

      "radius": "0.9rem"
    },

    "extended_tokens": {
      "surface": {
        "canvas": {
          "light": "214 45% 96%",
          "dark": "222 58% 10%"
        },
        "surface_1": {
          "light": "0 0% 100%",
          "dark": "222 52% 14%"
        },
        "surface_2": {
          "light": "214 38% 92%",
          "dark": "221 46% 24%"
        }
      },
      "shadow": {
        "sm": "0 1px 2px hsl(222 58% 14% / 0.08)",
        "md": "0 10px 24px hsl(222 58% 14% / 0.10)",
        "dark_sm": "0 1px 2px hsl(0 0% 0% / 0.35)",
        "dark_md": "0 10px 24px hsl(0 0% 0% / 0.45)"
      },
      "focus": {
        "ring_width": "3px",
        "ring_offset": "2px"
      }
    }
  },

  "typography": {
    "font_pairing": {
      "primary_ui": {
        "name": "Noto Sans Devanagari",
        "why": "Excellent Devanagari rendering + neutral enterprise tone; pairs cleanly with Latin.",
        "fallbacks": [
          "Noto Sans",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto"
        ]
      },
      "numeric": {
        "name": "IBM Plex Sans",
        "why": "Clear numerals for weights/₹; use for KPI tiles and tables if needed.",
        "fallbacks": ["Inter", "system-ui"]
      }
    },
    "implementation_notes_js": [
      "Load fonts via Google Fonts in public/index.html (CRA) or via CSS @import in index.css.",
      "Set body font-family to Noto Sans Devanagari stack; keep numerals consistent by using tabular-nums utility where needed."
    ],
    "type_scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "section_title": "text-xl md:text-2xl font-semibold",
      "card_title": "text-lg md:text-xl font-semibold",
      "body": "text-sm md:text-base",
      "label": "text-sm font-medium",
      "micro": "text-xs text-muted-foreground"
    },
    "bilingual_label_pattern": {
      "rule": "Always show Hindi first, English second (stacked) for low-literacy scanning.",
      "example": {
        "hi": "वज़न",
        "en": "Weight",
        "render": "<div className=\"leading-tight\"><div className=\"text-sm font-medium\">वज़न</div><div className=\"text-xs text-muted-foreground\">Weight</div></div>"
      }
    }
  },

  "layout_and_grid": {
    "global_structure": {
      "app_shell": "Top bar (context + search + language + theme) + left rail (desktop) / bottom bar (tablet) + content area.",
      "max_width": "Avoid narrow centered layouts; use full-width canvas with padded content.",
      "content_padding": "px-4 sm:px-6 lg:px-8 py-4",
      "section_spacing": "space-y-6 md:space-y-8",
      "card_spacing": "gap-3 md:gap-4",
      "touch_targets": "Minimum 44px height; prefer 48px for primary actions."
    },
    "responsive_patterns": {
      "bags_grid": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
      "detail_two_column": "lg:grid lg:grid-cols-[420px_1fr] lg:gap-6",
      "timeline_layout": "Single column on mobile; two-column (timeline + actions) on lg."
    }
  },

  "components": {
    "component_path": {
      "navigation": {
        "tabs": "/app/frontend/src/components/ui/tabs.jsx",
        "breadcrumb": "/app/frontend/src/components/ui/breadcrumb.jsx",
        "navigation_menu": "/app/frontend/src/components/ui/navigation-menu.jsx",
        "sheet_drawer": "/app/frontend/src/components/ui/sheet.jsx",
        "menubar": "/app/frontend/src/components/ui/menubar.jsx"
      },
      "forms": {
        "form": "/app/frontend/src/components/ui/form.jsx",
        "input": "/app/frontend/src/components/ui/input.jsx",
        "textarea": "/app/frontend/src/components/ui/textarea.jsx",
        "select": "/app/frontend/src/components/ui/select.jsx",
        "checkbox": "/app/frontend/src/components/ui/checkbox.jsx",
        "radio_group": "/app/frontend/src/components/ui/radio-group.jsx",
        "switch": "/app/frontend/src/components/ui/switch.jsx",
        "input_otp": "/app/frontend/src/components/ui/input-otp.jsx",
        "calendar": "/app/frontend/src/components/ui/calendar.jsx"
      },
      "data_display": {
        "card": "/app/frontend/src/components/ui/card.jsx",
        "badge": "/app/frontend/src/components/ui/badge.jsx",
        "table": "/app/frontend/src/components/ui/table.jsx",
        "progress": "/app/frontend/src/components/ui/progress.jsx",
        "separator": "/app/frontend/src/components/ui/separator.jsx",
        "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
        "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
        "avatar": "/app/frontend/src/components/ui/avatar.jsx"
      },
      "overlays": {
        "dialog": "/app/frontend/src/components/ui/dialog.jsx",
        "drawer": "/app/frontend/src/components/ui/drawer.jsx",
        "alert_dialog": "/app/frontend/src/components/ui/alert-dialog.jsx",
        "popover": "/app/frontend/src/components/ui/popover.jsx",
        "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
        "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx"
      },
      "actions": {
        "button": "/app/frontend/src/components/ui/button.jsx",
        "toggle": "/app/frontend/src/components/ui/toggle.jsx",
        "toggle_group": "/app/frontend/src/components/ui/toggle-group.jsx"
      }
    },

    "patterns": {
      "top_bar": {
        "purpose": "Always-visible context: Metal (Silver/Gold), Purity, Workspace (Demo/Real), Language, Theme.",
        "layout": "Sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
        "left": [
          "App name + current workspace badge",
          "Metal segmented control (Silver/Gold)",
          "Purity multi-select (chips)"
        ],
        "right": [
          "Search (bags/packets/karigar)",
          "Language toggle",
          "Theme toggle",
          "User menu"
        ],
        "data_testids": {
          "metal_switch": "metal-context-switch",
          "workspace_toggle": "workspace-toggle",
          "language_toggle": "language-toggle",
          "theme_toggle": "theme-toggle",
          "global_search": "global-search-input"
        }
      },

      "photo_led_card": {
        "use_for": ["Bags list", "Packets list", "Deliveries list"],
        "structure": [
          "Top: 4:3 photo thumbnail (AspectRatio) with status chips overlay",
          "Middle: bilingual title (Design name / Bag ID)",
          "Bottom: 2–3 big KPI pills (Gross wt, Metal balance, Step)",
          "Primary CTA: one large button (Open / Continue)"
        ],
        "tailwind": {
          "card": "rounded-xl border bg-card shadow-[var(--shadow-sm)] overflow-hidden",
          "thumb": "relative",
          "thumb_img": "h-full w-full object-cover",
          "thumb_overlay": "absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/45 to-transparent",
          "kpi_row": "mt-3 grid grid-cols-3 gap-2",
          "kpi_pill": "rounded-lg bg-muted px-2 py-2 text-center",
          "cta": "mt-3 h-12 w-full"
        },
        "empty_state": {
          "rule": "Never show blank; show skeletons while loading and a photo-placeholder card when empty.",
          "placeholder": "Use a neutral cloud-blue panel with camera icon + bilingual hint."
        },
        "data_testids": {
          "card": "photo-led-card",
          "open_button": "photo-led-card-open-button"
        }
      },

      "bag_detail_header": {
        "purpose": "Immediate visual confirmation + critical accounting summary.",
        "layout": "Photo strip (carousel) + summary tiles + primary actions.",
        "components": ["carousel", "card", "badge", "button", "tabs"],
        "actions": [
          "Add movement",
          "Repack",
          "Split/Merge",
          "QC",
          "Delivery"
        ],
        "summary_tiles": [
          "Issued metal (g)",
          "Returned metal (g)",
          "Outstanding loss (g)",
          "Recovered allocated (g)",
          "Cost ₹/kg"
        ],
        "data_testids": {
          "bag-photo-carousel": "bag-photo-carousel",
          "bag-primary-actions": "bag-primary-actions"
        }
      },

      "movement_timeline": {
        "purpose": "Photo-guided audit trail of packet movements with weight-in/out and loss per step.",
        "visual": "Vertical timeline with step cards; each node shows step name (bilingual), timestamp, operator, photo thumbnail, weight delta.",
        "component_suggestion": "Use Card + Separator; optionally add a custom Timeline component (simple divs) rather than heavy libs.",
        "status_colors": {
          "pass": "badge bg-[hsl(var(--status-success))] text-white",
          "fail": "badge bg-[hsl(var(--status-danger))] text-white",
          "rework": "badge bg-[hsl(var(--status-warning))] text-black"
        },
        "data_testids": {
          "timeline": "packet-movement-timeline",
          "timeline_item": "packet-movement-timeline-item"
        }
      },

      "otp_sign_in": {
        "screen": "Login / OTP sign-in",
        "layout": "Two-panel on desktop (left: calm brand panel; right: OTP form). Single column on mobile/tablet.",
        "components": ["card", "input-otp", "button", "alert"],
        "microcopy": "Bilingual, short: 'Code from supervisor' / 'सुपरवाइज़र का कोड'",
        "data_testids": {
          "otp_input": "otp-input",
          "otp_submit": "otp-submit-button",
          "supervisor_code_panel": "supervisor-code-panel"
        }
      },

      "tables_vs_cards_rule": {
        "rule": "Default to cards for lists; use tables only for accountant views and export-like screens.",
        "table_requirements": [
          "Sticky header",
          "Row height >= 48px",
          "First column includes thumbnail when available",
          "Inline status badges",
          "Row actions as a single kebab menu (DropdownMenu)"
        ]
      }
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Motion is functional: confirm taps, show state changes, reduce anxiety during saves.",
      "Respect prefers-reduced-motion.",
      "No universal transition: never use transition: all."
    ],
    "recommended_library": {
      "name": "framer-motion",
      "why": "For subtle entrance/exit of dialogs, card hover lift, timeline reveal.",
      "install": "npm i framer-motion",
      "usage_examples": [
        "AnimatePresence for Dialog/Drawer content",
        "whileTap={{ scale: 0.98 }} for primary buttons",
        "staggerChildren for card grids"
      ]
    },
    "interaction_specs": {
      "buttons": {
        "hover": "bg shift + subtle shadow increase (no transform transition conflicts)",
        "press": "scale 0.98 (framer) + immediate",
        "focus": "3px ring using --ring"
      },
      "cards": {
        "hover": "shadow-sm -> shadow-md; border color slightly stronger",
        "loading": "skeleton shimmer (shadcn Skeleton)"
      },
      "save_feedback": {
        "pattern": "Inline 'Saving…' chip + Sonner toast on success/failure",
        "toast": "Use sonner; keep copy bilingual and short"
      }
    }
  },

  "imagery": {
    "image_urls": {
      "note": "App uses user-uploaded photos; these URLs are only for empty-state placeholders in demo mode or marketing docs.",
      "placeholders": [
        {
          "category": "empty_state_background",
          "description": "Soft cloud-blue abstract texture (very subtle) for empty states; keep contrast high.",
          "url": "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=60"
        },
        {
          "category": "login_side_panel",
          "description": "Calm industrial macro texture (metal surface) to hint silver/gold without being flashy.",
          "url": "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=60"
        }
      ]
    },
    "photo_treatment": {
      "rules": [
        "Always show photos in 4:3 or 1:1 frames; avoid odd crops.",
        "Use AspectRatio component; object-cover.",
        "Overlay status chips on photo bottom-left; keep readable with a subtle dark scrim.",
        "Provide 'Retake photo' as a primary action in capture flows."
      ],
      "thumbnail_quality": {
        "loading": "Skeleton with same aspect ratio",
        "error": "Fallback panel with camera-off icon + bilingual text",
        "empty": "Placeholder panel with dashed border"
      }
    }
  },

  "accessibility_and_i18n": {
    "a11y": {
      "targets": [
        "WCAG AA contrast",
        "Keyboard navigable",
        "Visible focus ring",
        "Touch targets >= 44px",
        "Avoid relying on color alone for status (use icons + labels)"
      ],
      "aria": [
        "All icon-only buttons must have aria-label in both languages (or language-agnostic label).",
        "Dialogs must trap focus (shadcn handles)."
      ]
    },
    "bilingual_system": {
      "toggle": "Top bar toggle: हिंदी / English",
      "pattern": "For critical fields, show bilingual stacked labels; for dense tables, allow single-language mode to reduce clutter.",
      "date_number": "Use locale-aware formatting; keep grams and ₹ explicit.",
      "data_testids": {
        "language_toggle": "language-toggle",
        "bilingual_label": "bilingual-label"
      }
    }
  },

  "screens": {
    "dashboard": {
      "layout": "Role-aware: Manager sees Today queue + exceptions; Accountant sees costing + deliveries; Admin sees settings + audit.",
      "modules": [
        "Today’s movements (photo-led)",
        "Exceptions (QC fail, missing weights, negative balance)",
        "Recovery pending",
        "Deliveries due",
        "Quick actions"
      ],
      "kpi_tiles": {
        "style": "Large numerals, tabular-nums, bilingual label, subtle border",
        "tiles": ["Open bags", "In QC", "Rework", "Delivered today"]
      }
    },
    "bags_list": {
      "primary": "Photo-led cards grid",
      "filters": "Metal, purity, step, karigar, date range",
      "filter_ui": "Use Sheet on tablet for filters; keep list uncluttered"
    },
    "bag_intake": {
      "pattern": "Wizard-like sections with photos first: 1) Photos 2) Metal issue 3) Stones issue 4) Assign karigar 5) Review",
      "validation": "Inline errors under fields; bilingual; never only red color—add icon + text"
    },
    "packet_detail": {
      "pattern": "Top: photo + current step + balance; Middle: timeline; Bottom: big action bar",
      "action_bar": "Sticky bottom action bar on tablet with 2–3 primary actions"
    },
    "settings": {
      "pattern": "Use Tabs: Production Steps / Labour Rates / Expense Categories / Demo Reset / Language",
      "danger_zone": "Demo reset and destructive actions must use AlertDialog"
    }
  },

  "libraries_and_integrations": {
    "recommended": [
      {
        "name": "recharts",
        "why": "Simple KPI charts for dashboard (loss trend, recovery allocation).",
        "install": "npm i recharts",
        "usage": "Use muted gridlines; avoid rainbow palettes; use velvet-blue for primary series and silver for secondary."
      },
      {
        "name": "react-i18next",
        "why": "Bilingual labels and future-proof localization.",
        "install": "npm i i18next react-i18next",
        "usage": "Store keys like 'bag.weight' and provide hi/en resources; for low literacy, keep strings short."
      }
    ]
  },

  "instructions_to_main_agent": [
    "Replace default shadcn neutral tokens in /app/frontend/src/index.css with the provided velvet-blue/silver/cloud-blue semantic tokens for both :root and .dark.",
    "Remove CRA demo styles in /app/frontend/src/App.css (centered header, spinning logo). Do not center the app container.",
    "Adopt photo-led cards as the default list pattern (bags/packets/deliveries).",
    "Implement bilingual stacked labels everywhere in data-entry flows; provide a top-bar language toggle.",
    "Ensure every interactive element and key info element includes a stable data-testid (kebab-case).",
    "Use shadcn components from /src/components/ui only (no raw HTML dropdown/calendar/toast).",
    "Keep touch targets >= 44px; primary buttons should be h-12 or larger.",
    "Use Sonner for toasts; keep messages bilingual and short.",
    "Avoid gradients except subtle header background accents (<20% viewport)."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
