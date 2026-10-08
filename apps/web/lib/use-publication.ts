"use client";

import { useMemo } from "react";

import { diffMenu } from "@/lib/menu-diff";
import { useMenuStore } from "@/lib/menu-store";

/** What publishing would change, and whether there is anything to publish. */
export function usePublication() {
  const { state } = useMenuStore();
  const changes = useMemo(
    () =>
      diffMenu(state.published, {
        venue: state.venue,
        categories: state.categories,
      }),
    [state.categories, state.published, state.venue],
  );
  const hasContent = state.categories.some((category) => category.items.length);
  const online = Boolean(state.published);
  const pending = online ? changes.length > 0 : hasContent;
  const changedItemIds = useMemo(
    () =>
      new Set(
        changes
          .map((change) => /^item(?:-added)?-(.+)$/.exec(change.id)?.[1])
          .filter((id): id is string => Boolean(id)),
      ),
    [changes],
  );
  return {
    online,
    pending,
    changes: online ? changes : [],
    changedItemIds: online ? changedItemIds : new Set<string>(),
    version: state.published?.version ?? 0,
  };
}
