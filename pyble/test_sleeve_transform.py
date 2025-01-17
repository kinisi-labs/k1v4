import json
from sleeve_transform import create_sleeve_packet, protobuf_to_json

def compare_records(original_raw, reversed_raw, tolerance=0.001):
    """
    Compare fields expected to be preserved in the roundtrip transformation
    with a tolerance for floating-point values.
    Returns (passed: bool, reason: str).
    """
    keys_to_check = ["i", "t_s", "a0", "g0", "m0", "a1", "g1", "m1"]
    
    for key in keys_to_check:
        orig = original_raw.get(key)
        rev = reversed_raw.get(key)
        
        # Check for presence
        if orig is None or rev is None:
            if orig != rev:
                return False, f"Key '{key}' mismatch: original={orig}, reversed={rev}"
            continue
        
        # If both are lists, compare each element with tolerance
        if isinstance(orig, list) and isinstance(rev, list):
            if len(orig) != len(rev):
                return False, f"Length mismatch for key '{key}': {len(orig)} vs {len(rev)}"
            for i, (o, r) in enumerate(zip(orig, rev)):
                try:
                    # Numeric comparison with tolerance
                    if abs(o - r) > tolerance:
                        return False, (f"Value mismatch for key '{key}' at index {i}: "
                                       f"{o} vs {r} exceeds tolerance {tolerance}")
                except TypeError:
                    # If not numeric, check equality
                    if o != r:
                        return False, f"Value mismatch for key '{key}' at index {i}: {o} != {r}"
        
        # If both are numeric but not lists
        elif isinstance(orig, (int, float)) and isinstance(rev, (int, float)):
            if abs(orig - rev) > tolerance:
                return False, f"Value mismatch for key '{key}': {orig} vs {rev} exceeds tolerance {tolerance}"
        
        # For other types, direct comparison
        else:
            if orig != rev:
                return False, f"Mismatch for key '{key}': {orig} != {rev}"
                
    return True, ""

def main():
    # Define multiple JSON examples for testing
    examples = [
        {
            "timestamp": 1737004733.6140008,
            "raw_record": {
                "i": 1269395,
                "t_s": 31747426,
                "g1": [0.015, 0.003, 0.001],
                "a1": [-1.863, -1.642, -9.347],
                "m1": [49.5, -23.1, -11.55],
                "g0": [0.079, -0.097, -0.055],
                "a0": [1.46, -7.473, -5.999],
                "m0": [-15.273, -9.091, 23.122],
                "sn": 5.652,
                "tch": True
            }
        },
        {
            "timestamp": 1737004750.123456,
            "raw_record": {
                "i": 1269396,
                "t_s": 31747450,
                "g1": [0.020, 0.004, 0.002],
                "a1": [-1.8, -1.6, -9.3],
                "m1": [50.0, -24.0, -12.0],
                "g0": [0.08, -0.098, -0.056],
                "a0": [1.5, -7.5, -6.0],
                "m0": [-15.3, -9.1, 23.1],
                "sn": 6.0,
                "tch": False
            }
        }
    ]

    device_id = "DEVICE_1234"
    results = []

    for idx, data in enumerate(examples, start=1):
        print(f"\n--- Test Example {idx} ---")
        print("Original JSON:")
        print(json.dumps(data, indent=2))

        try:
            # Convert JSON to protobuf
            packet = create_sleeve_packet(data, device_id)

            # Convert protobuf back to JSON
            reversed_json = protobuf_to_json(packet)

            # Compare original and reversed records
            passed, reason = compare_records(data["raw_record"], reversed_json["raw_record"])

        except Exception as e:
            passed = False
            reason = f"Exception during transformation: {e}"

        # Compute sizes
        json_size = len(json.dumps(data).encode('utf-8'))
        protobuf_size = packet.ByteSize() if 'packet' in locals() else 0

        results.append({
            "example": idx,
            "json_size": json_size,
            "pb_size": protobuf_size,
            "passed": passed,
            "reason": reason
        })

        # Output detailed test result for this example
        print(f"\nTest Example {idx} Passed: {passed}")
        if not passed:
            print(f"Reason: {reason}")

    # Print a summary table of results
    print("\nSummary Table:")
    print(f"{'Example':<8} {'JSON Size':<10} {'Protobuf Size':<15} {'Passed':<6}")
    for result in results:
        print(f"{result['example']:<8} {result['json_size']:<10} {result['pb_size']:<15} {str(result['passed']):<6}")

if __name__ == "__main__":
    main()
