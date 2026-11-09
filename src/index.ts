// NPTEL Courses connector entry point.
// Wires exported capabilities to implement the connector protocol.
import type { ConnectorModule } from "@callopus/connector-sdk";
import { catalog } from "./callopus/catalog";
import { fetchCourse } from "./callopus/course";

const connector: ConnectorModule = {
  catalog,
  fetchCourse,
};

export default connector;
