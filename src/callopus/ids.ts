// Course ids in Callopus carry a prefix that names this connector.

const NAMESPACE_PREFIX = "nptelcourses_";

/**
 * Returns a namespaced course ID with the prefix applied.
 */
export function namespaceOf(id: string | number): string {
  return `${NAMESPACE_PREFIX}${id}`;
}

/**
 * Strips the namespace prefix to recover the platform course ID.
 */
export function idFromNamespace(namespace: string): string {
  return namespace.slice(NAMESPACE_PREFIX.length);
}
