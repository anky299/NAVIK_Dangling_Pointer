import re

def main():
    with open("config/routes.yaml", "r") as f:
        text = f.read()

    routes = []
    current_route = {}
    in_routes = False

    for line in text.splitlines():
        if line.strip().startswith("routes:"):
            in_routes = True
            continue
        if in_routes and line.strip().startswith("# ===="):
            break
        if in_routes:
            m_id = re.search(r'route_id:\s*"([^"]+)"', line)
            if m_id:
                if current_route:
                    routes.append(current_route)
                current_route = {"route_id": m_id.group(1)}
            m_orig = re.search(r'origin_port:\s*"([^"]+)"', line)
            if m_orig:
                current_route["origin_port"] = m_orig.group(1)
            m_dest = re.search(r'destination_port:\s*"([^"]+)"', line)
            if m_dest:
                current_route["destination_port"] = m_dest.group(1)
            m_dist = re.search(r'distance_nm:\s*(\d+)', line)
            if m_dist:
                current_route["distance_nm"] = int(m_dist.group(1))
            m_vess = re.search(r'eligible_vessel_classes:\s*\[([^\]]+)\]', line)
            if m_vess:
                classes = [c.strip().strip('"\'') for c in m_vess.group(1).split(",")]
                current_route["vessels"] = ", ".join(classes)

    if current_route:
        routes.append(current_route)

    print(f"Total Routes Parsed: {len(routes)}\n")
    print("| Route ID | Origin Port | Destination Port | Distance | Eligible Vessel Classes |")
    print("|---|---|---|---|---|")
    for r in routes:
        print(f"| `{r['route_id']}` | {r['origin_port']} | {r['destination_port']} | {r['distance_nm']:,} nm | {r.get('vessels', '')} |")

if __name__ == "__main__":
    main()
