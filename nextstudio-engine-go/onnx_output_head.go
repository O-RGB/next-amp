package main

import "fmt"

// The native model normally returns [1,1024,64,2], while the production GO
// timeline consumes only frames 32..63 for its one-chunk lookahead. This small
// protobuf-level rewrite adds an ONNX Slice output head without touching any
// learned weights or decoder nodes. It deliberately preserves unknown fields
// so an unsupported graph can fall back to the original model bytes.

const (
	compactOutputStart  = 32
	compactOutputFrames = 32
	compactOutputName   = "NextAmp/compact_output"
	compactOutputPrefix = "NextAmp/compact_output_head/"
	compactROIPrefix    = "NextAmp/compact_roi/"
)

type onnxWireField struct {
	number int
	wire   int
	value  []byte
	raw    []byte
}

func readONNXUvarint(data []byte, pos *int) (uint64, error) {
	var value uint64
	for shift := uint(0); shift < 64; shift += 7 {
		if *pos >= len(data) {
			return 0, fmt.Errorf("truncated protobuf varint")
		}
		b := data[*pos]
		*pos++
		value |= uint64(b&0x7f) << shift
		if b&0x80 == 0 {
			return value, nil
		}
	}
	return 0, fmt.Errorf("protobuf varint overflow")
}

func appendONNXUvarint(dst []byte, value uint64) []byte {
	for value >= 0x80 {
		dst = append(dst, byte(value)|0x80)
		value >>= 7
	}
	return append(dst, byte(value))
}

func parseONNXFields(data []byte) ([]onnxWireField, error) {
	fields := make([]onnxWireField, 0, 16)
	for pos := 0; pos < len(data); {
		start := pos
		key, err := readONNXUvarint(data, &pos)
		if err != nil {
			return nil, err
		}
		number := int(key >> 3)
		wire := int(key & 7)
		if number <= 0 {
			return nil, fmt.Errorf("invalid protobuf field number %d", number)
		}

		var value []byte
		switch wire {
		case 0:
			if _, err := readONNXUvarint(data, &pos); err != nil {
				return nil, err
			}
		case 1:
			if len(data)-pos < 8 {
				return nil, fmt.Errorf("truncated fixed64 field %d", number)
			}
			pos += 8
		case 2:
			length, err := readONNXUvarint(data, &pos)
			if err != nil || length > uint64(len(data)-pos) {
				return nil, fmt.Errorf("invalid length-delimited field %d", number)
			}
			value = data[pos : pos+int(length)]
			pos += int(length)
		case 5:
			if len(data)-pos < 4 {
				return nil, fmt.Errorf("truncated fixed32 field %d", number)
			}
			pos += 4
		default:
			return nil, fmt.Errorf("unsupported protobuf wire type %d", wire)
		}
		fields = append(fields, onnxWireField{
			number: number,
			wire:   wire,
			value:  value,
			raw:    data[start:pos],
		})
	}
	return fields, nil
}

func marshalONNXField(number, wire int, value []byte) []byte {
	result := make([]byte, 0, len(value)+12)
	result = appendONNXUvarint(result, uint64(number<<3|wire))
	if wire == 2 {
		result = appendONNXUvarint(result, uint64(len(value)))
	}
	return append(result, value...)
}

func marshalONNXVarintField(number int, value uint64) []byte {
	result := make([]byte, 0, 12)
	result = appendONNXUvarint(result, uint64(number<<3))
	return appendONNXUvarint(result, value)
}

func marshalONNXStringField(number int, value string) []byte {
	return marshalONNXField(number, 2, []byte(value))
}

func marshalONNXPackedInt64Field(number int, values []int64) []byte {
	packed := make([]byte, 0, len(values)*2)
	for _, value := range values {
		packed = appendONNXUvarint(packed, uint64(value))
	}
	return marshalONNXField(number, 2, packed)
}

func marshalONNXMessage(fields []onnxWireField, appended ...[]byte) []byte {
	result := make([]byte, 0)
	for _, field := range fields {
		result = append(result, field.raw...)
	}
	for _, field := range appended {
		result = append(result, field...)
	}
	return result
}

func firstONNXBytes(fields []onnxWireField, number int) []byte {
	for _, field := range fields {
		if field.number == number && field.wire == 2 {
			return field.value
		}
	}
	return nil
}

func allONNXBytes(fields []onnxWireField, number int) [][]byte {
	values := make([][]byte, 0, 1)
	for _, field := range fields {
		if field.number == number && field.wire == 2 {
			values = append(values, field.value)
		}
	}
	return values
}

func onnxVarintValue(field onnxWireField) (uint64, bool) {
	if field.wire != 0 {
		return 0, false
	}
	pos := 0
	if _, err := readONNXUvarint(field.raw, &pos); err != nil {
		return 0, false
	}
	value, err := readONNXUvarint(field.raw, &pos)
	return value, err == nil
}

func onnxInt64Values(fields []onnxWireField, number int) []int64 {
	values := make([]int64, 0, 4)
	for _, field := range fields {
		if field.number != number {
			continue
		}
		if field.wire == 0 {
			if value, ok := onnxVarintValue(field); ok {
				values = append(values, int64(value))
			}
			continue
		}
		if field.wire != 2 {
			continue
		}
		pos := 0
		for pos < len(field.value) {
			value, err := readONNXUvarint(field.value, &pos)
			if err != nil {
				return nil
			}
			values = append(values, int64(value))
		}
	}
	return values
}

func onnxNodeAttributeInts(nodeFields []onnxWireField, name string) []int64 {
	for _, attribute := range allONNXBytes(nodeFields, 5) {
		fields, err := parseONNXFields(attribute)
		if err != nil || string(firstONNXBytes(fields, 1)) != name {
			continue
		}
		values := onnxInt64Values(fields, 8) // AttributeProto.ints
		if len(values) == 0 {
			values = onnxInt64Values(fields, 3) // AttributeProto.i
		}
		return values
	}
	return nil
}

func rewriteONNXNodeInput(data []byte, oldName, newName string) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	result := make([]byte, 0, len(data)+len(newName))
	replaced := false
	for _, field := range fields {
		if !replaced && field.number == 1 && field.wire == 2 && string(field.value) == oldName {
			result = append(result, marshalONNXStringField(1, newName)...)
			replaced = true
			continue
		}
		result = append(result, field.raw...)
	}
	return result, replaced, nil
}

func rewriteONNXNodeOutput(data []byte, oldName, newName string) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	result := make([]byte, 0, len(data)+len(newName))
	replaced := false
	for _, field := range fields {
		if !replaced && field.number == 2 && field.wire == 2 && string(field.value) == oldName {
			result = append(result, marshalONNXStringField(2, newName)...)
			replaced = true
			continue
		}
		result = append(result, field.raw...)
	}
	return result, replaced, nil
}

func rewriteONNXDimension(data []byte, dimensionIndex int) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	if dimensionIndex != 2 {
		return data, false, nil
	}
	result := make([]byte, 0, len(data))
	replaced := false
	for _, field := range fields {
		if field.number == 1 && field.wire == 0 {
			result = append(result, marshalONNXVarintField(1, compactOutputFrames)...)
			replaced = true
		} else {
			result = append(result, field.raw...)
		}
	}
	return result, replaced, nil
}

func rewriteONNXShape(data []byte) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	result := make([]byte, 0, len(data))
	dimensionIndex := 0
	replaced := false
	for _, field := range fields {
		if field.number == 1 && field.wire == 2 {
			dimension, changed, err := rewriteONNXDimension(field.value, dimensionIndex)
			if err != nil {
				return nil, false, err
			}
			result = append(result, marshalONNXField(1, 2, dimension)...)
			replaced = replaced || changed
			dimensionIndex++
		} else {
			result = append(result, field.raw...)
		}
	}
	return result, replaced, nil
}

func rewriteONNXTensorType(data []byte) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	result := make([]byte, 0, len(data))
	replaced := false
	for _, field := range fields {
		if field.number == 2 && field.wire == 2 {
			shape, changed, err := rewriteONNXShape(field.value)
			if err != nil {
				return nil, false, err
			}
			result = append(result, marshalONNXField(2, 2, shape)...)
			replaced = replaced || changed
		} else {
			result = append(result, field.raw...)
		}
	}
	return result, replaced, nil
}

func rewriteONNXType(data []byte) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	result := make([]byte, 0, len(data))
	replaced := false
	for _, field := range fields {
		if field.number == 1 && field.wire == 2 {
			tensorType, changed, err := rewriteONNXTensorType(field.value)
			if err != nil {
				return nil, false, err
			}
			result = append(result, marshalONNXField(1, 2, tensorType)...)
			replaced = replaced || changed
		} else {
			result = append(result, field.raw...)
		}
	}
	return result, replaced, nil
}

func rewriteONNXValueInfo(data []byte, oldName, newName string) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}
	if string(firstONNXBytes(fields, 1)) != oldName {
		return data, false, nil
	}
	result := make([]byte, 0, len(data))
	replaced := false
	for _, field := range fields {
		switch {
		case field.number == 1 && field.wire == 2:
			result = append(result, marshalONNXStringField(1, newName)...)
			replaced = true
		case field.number == 2 && field.wire == 2:
			typeInfo, changed, err := rewriteONNXType(field.value)
			if err != nil {
				return nil, false, err
			}
			result = append(result, marshalONNXField(2, 2, typeInfo)...)
			replaced = replaced || changed
		default:
			result = append(result, field.raw...)
		}
	}
	return result, replaced, nil
}

func makeONNXInitializer(name string, values []int64) []byte {
	result := make([]byte, 0, len(values)*3+len(name)+16)
	result = append(result, marshalONNXPackedInt64Field(1, []int64{int64(len(values))})...)
	result = append(result, marshalONNXVarintField(2, 7)...)
	result = append(result, marshalONNXPackedInt64Field(7, values)...)
	result = append(result, marshalONNXStringField(8, name)...)
	return marshalONNXField(5, 2, result)
}

func makeONNXOutputSliceNode(inputName string) []byte {
	return makeONNXROISliceNode(compactOutputPrefix, inputName, compactOutputName)
}

func makeONNXROISliceNode(prefix, inputName, outputName string) []byte {
	result := make([]byte, 0, 180)
	for _, input := range []string{
		inputName,
		prefix + "starts",
		prefix + "ends",
		prefix + "axes",
		prefix + "steps",
	} {
		result = append(result, marshalONNXStringField(1, input)...)
	}
	result = append(result, marshalONNXStringField(2, outputName)...)
	result = append(result, marshalONNXStringField(3, prefix+"slice")...)
	result = append(result, marshalONNXStringField(4, "Slice")...)
	return marshalONNXField(1, 2, result)
}

type onnxROITarget struct {
	convName      string
	convInput     string
	transposeName string
	decoderName   string
	decoderInput  string
}

func findONNXFinalProjection(fields []onnxWireField) (onnxROITarget, bool, error) {
	nodes := make([][]onnxWireField, 0, 128)
	for _, field := range fields {
		if field.number != 1 || field.wire != 2 {
			continue
		}
		nodeFields, err := parseONNXFields(field.value)
		if err != nil {
			return onnxROITarget{}, false, err
		}
		nodes = append(nodes, nodeFields)
	}
	for _, transpose := range nodes {
		if string(firstONNXBytes(transpose, 4)) != "Transpose" {
			continue
		}
		outputs := allONNXBytes(transpose, 2)
		if len(outputs) != 1 || string(outputs[0]) != "Identity" {
			continue
		}
		perm := onnxNodeAttributeInts(transpose, "perm")
		// Conv is NCHW here and the final transpose is NCHW -> NHWC.
		// Consequently the audio time axis is Conv axis 3.
		if len(perm) != 4 || perm[0] != 0 || perm[1] != 2 || perm[2] != 3 || perm[3] != 1 {
			continue
		}
		transposeInput := string(firstONNXBytes(transpose, 1))
		for _, conv := range nodes {
			if string(firstONNXBytes(conv, 4)) != "Conv" ||
				string(firstONNXBytes(conv, 2)) != transposeInput {
				continue
			}
			kernel := onnxNodeAttributeInts(conv, "kernel_shape")
			strides := onnxNodeAttributeInts(conv, "strides")
			dilations := onnxNodeAttributeInts(conv, "dilations")
			pads := onnxNodeAttributeInts(conv, "pads")
			group := onnxNodeAttributeInts(conv, "group")
			inputs := allONNXBytes(conv, 1)
			if len(inputs) < 2 || len(kernel) != 2 || kernel[0] != 1 || kernel[1] != 1 ||
				len(strides) != 2 || strides[0] != 1 || strides[1] != 1 ||
				len(dilations) != 2 || dilations[0] != 1 || dilations[1] != 1 ||
				len(pads) != 4 || pads[0] != 0 || pads[1] != 0 || pads[2] != 0 || pads[3] != 0 ||
				len(group) != 1 || group[0] != 1 {
				continue
			}
			target := onnxROITarget{
				convName:      string(firstONNXBytes(conv, 3)),
				convInput:     string(inputs[0]),
				transposeName: string(firstONNXBytes(transpose, 3)),
			}
			// The layer immediately before the 1x1 projection is the final
			// 3x3 SAME decoder layer. It needs one frame of left halo to
			// produce global frames 32..63 exactly. If a different export has
			// no such layer, the caller keeps the older projection-only crop.
			decoderActivationInput := target.convInput
			for _, activation := range nodes {
				if string(firstONNXBytes(activation, 4)) == "Relu" &&
					string(firstONNXBytes(activation, 2)) == target.convInput {
					activationInputs := allONNXBytes(activation, 1)
					if len(activationInputs) == 1 {
						decoderActivationInput = string(activationInputs[0])
					}
					break
				}
			}
			for _, decoder := range nodes {
				if string(firstONNXBytes(decoder, 4)) != "Conv" ||
					string(firstONNXBytes(decoder, 2)) != decoderActivationInput {
					continue
				}
				decoderKernel := onnxNodeAttributeInts(decoder, "kernel_shape")
				decoderStrides := onnxNodeAttributeInts(decoder, "strides")
				decoderDilations := onnxNodeAttributeInts(decoder, "dilations")
				decoderPads := onnxNodeAttributeInts(decoder, "pads")
				decoderInputs := allONNXBytes(decoder, 1)
				if len(decoderInputs) < 1 || len(decoderKernel) != 2 ||
					decoderKernel[0] != 3 || decoderKernel[1] != 3 ||
					len(decoderStrides) != 2 || decoderStrides[0] != 1 || decoderStrides[1] != 1 ||
					len(decoderDilations) != 2 || decoderDilations[0] != 1 || decoderDilations[1] != 1 ||
					len(decoderPads) != 4 || decoderPads[0] != 1 || decoderPads[1] != 1 ||
					decoderPads[2] != 1 || decoderPads[3] != 1 {
					continue
				}
				target.decoderName = string(firstONNXBytes(decoder, 3))
				target.decoderInput = string(decoderInputs[0])
				break
			}
			return target, true, nil
		}
	}
	return onnxROITarget{}, false, nil
}

func rewriteONNXGraphOutput(data []byte) ([]byte, bool, error) {
	fields, err := parseONNXFields(data)
	if err != nil {
		return nil, false, err
	}

	identityOutput := ""
	for _, field := range fields {
		if field.number != 1 || field.wire != 2 {
			continue
		}
		nodeFields, err := parseONNXFields(field.value)
		if err != nil {
			return nil, false, err
		}
		opType := string(firstONNXBytes(nodeFields, 4))
		if opType != "Transpose" {
			continue
		}
		for _, output := range allONNXBytes(nodeFields, 2) {
			if string(output) == "Identity" {
				identityOutput = "Identity"
				break
			}
		}
	}
	if identityOutput == "" {
		return data, false, nil
	}
	roiTarget, roiAvailable, err := findONNXFinalProjection(fields)
	if err != nil {
		return nil, false, err
	}

	result := make([]byte, 0, len(data)+1200)
	outputChanged := false
	roiApplied := false
	deepROI := roiAvailable && roiTarget.decoderName != ""
	decoderApplied := false
	for _, field := range fields {
		if field.number == 1 && field.wire == 2 {
			nodeFields, nodeErr := parseONNXFields(field.value)
			if nodeErr != nil {
				return nil, false, nodeErr
			}
			nodeName := string(firstONNXBytes(nodeFields, 3))
			if deepROI && nodeName == roiTarget.decoderName {
				croppedInput := compactROIPrefix + "decoder_layer_input:0"
				croppedNode, changed, rewriteErr := rewriteONNXNodeInput(field.value, roiTarget.decoderInput, croppedInput)
				if rewriteErr != nil {
					return nil, false, rewriteErr
				}
				if changed {
					result = append(result, makeONNXROISliceNode(
						compactROIPrefix+"decoder_layer/",
						roiTarget.decoderInput,
						croppedInput,
					)...)
					result = append(result, marshalONNXField(1, 2, croppedNode)...)
					decoderApplied = true
					continue
				}
			}
			if roiAvailable && nodeName == roiTarget.convName {
				croppedInput := compactROIPrefix + "decoder_input:0"
				projectionPrefix := compactROIPrefix
				if deepROI {
					// The decoder crop starts at global frame 31, so the
					// final projection selects local frames 1..32.
					croppedInput = compactROIPrefix + "projection_input:0"
					projectionPrefix = compactROIPrefix + "projection/"
				}
				croppedNode, changed, rewriteErr := rewriteONNXNodeInput(field.value, roiTarget.convInput, croppedInput)
				if rewriteErr != nil {
					return nil, false, rewriteErr
				}
				if changed {
					result = append(result, makeONNXROISliceNode(
						projectionPrefix,
						roiTarget.convInput, croppedInput,
					)...)
					result = append(result, marshalONNXField(1, 2, croppedNode)...)
					roiApplied = true
					continue
				}
			}
			if roiAvailable && nodeName == roiTarget.transposeName {
				renamedNode, changed, renameErr := rewriteONNXNodeOutput(field.value, identityOutput, compactOutputName)
				if renameErr != nil {
					return nil, false, renameErr
				}
				if changed {
					result = append(result, marshalONNXField(1, 2, renamedNode)...)
					continue
				}
			}
		}
		if field.number == 12 && field.wire == 2 {
			outputInfo, changed, err := rewriteONNXValueInfo(field.value, identityOutput, compactOutputName)
			if err != nil {
				return nil, false, err
			}
			if changed {
				result = append(result, marshalONNXField(12, 2, outputInfo)...)
				outputChanged = true
				continue
			}
		}
		result = append(result, field.raw...)
	}
	if !outputChanged {
		return data, false, nil
	}
	if deepROI && (!decoderApplied || !roiApplied) {
		// Never leave a partially specialized graph behind.
		return data, false, nil
	}

	if roiApplied {
		if deepROI {
			// Decoder output is local frames 0..32 for global frames
			// 31..63. The projection crop keeps local frames 1..32.
			result = append(result, makeONNXInitializer(compactROIPrefix+"decoder_layer/starts", []int64{31})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"decoder_layer/ends", []int64{64})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"decoder_layer/axes", []int64{3})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"decoder_layer/steps", []int64{1})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"projection/starts", []int64{1})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"projection/ends", []int64{33})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"projection/axes", []int64{3})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"projection/steps", []int64{1})...)
		} else {
			// Projection-only fallback: crop the frame-independent layer
			// directly to global frames 32..63.
			result = append(result, makeONNXInitializer(compactROIPrefix+"starts", []int64{32})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"ends", []int64{64})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"axes", []int64{3})...)
			result = append(result, makeONNXInitializer(compactROIPrefix+"steps", []int64{1})...)
		}
	} else {
		result = append(result, makeONNXOutputSliceNode(identityOutput)...)
		result = append(result, makeONNXInitializer(compactOutputPrefix+"starts", []int64{0, 0, compactOutputStart, 0})...)
		result = append(result, makeONNXInitializer(compactOutputPrefix+"ends", []int64{1, 1024, 64, 2})...)
		result = append(result, makeONNXInitializer(compactOutputPrefix+"axes", []int64{0, 1, 2, 3})...)
		result = append(result, makeONNXInitializer(compactOutputPrefix+"steps", []int64{1, 1, 1, 1})...)
	}
	return result, true, nil
}

func rewriteONNXOutputWindow(modelData []byte) ([]byte, bool, error) {
	fields, err := parseONNXFields(modelData)
	if err != nil {
		return nil, false, err
	}
	result := make([]byte, 0, len(modelData)+700)
	applied := false
	for _, field := range fields {
		if field.number == 7 && field.wire == 2 {
			graph, changed, err := rewriteONNXGraphOutput(field.value)
			if err != nil {
				return nil, false, err
			}
			if changed {
				result = append(result, marshalONNXField(7, 2, graph)...)
				applied = true
				continue
			}
		}
		result = append(result, field.raw...)
	}
	if !applied {
		return modelData, false, nil
	}
	return result, true, nil
}
